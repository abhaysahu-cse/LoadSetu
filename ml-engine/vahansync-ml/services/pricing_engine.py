"""
LoadSetu x VahanSync — V1 Pricing Engine
Deterministic rule-based freight pricing.
V2 will replace rule engine with XGBoost surge pricing.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

from config.settings import get_settings
from models.schemas import PricingBreakdown

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Truck-type specific rate multipliers
# ---------------------------------------------------------------------------
TRUCK_TYPE_MULTIPLIERS: dict[str, float] = {
    "flatbed": 1.00,
    "container": 1.15,
    "refrigerated": 1.35,   # Cold chain premium
    "tanker": 1.20,
    "tipper": 0.95,
    "trailer": 1.10,
    "unknown": 1.00,
}

# ---------------------------------------------------------------------------
# State-wise toll rate corrections (INR per 100km)
# These approximate actual highway toll rates on major corridors
# ---------------------------------------------------------------------------
CORRIDOR_TOLL_CORRECTIONS: dict[frozenset[str], float] = {
    frozenset({"surat", "bhopal"}): 145.0,
    frozenset({"mumbai", "pune"}): 185.0,
    frozenset({"delhi", "jaipur"}): 130.0,
    frozenset({"ahmedabad", "mumbai"}): 160.0,
    frozenset({"bangalore", "chennai"}): 120.0,
}

# ---------------------------------------------------------------------------
# Load-type specific fuel surcharge modifiers
# ---------------------------------------------------------------------------
LOAD_TYPE_FUEL_MODIFIER: dict[str, float] = {
    "steel": 1.15,          # Heavy, higher fuel burn
    "chemicals": 1.10,
    "tipper": 1.05,
    "refrigerated": 1.30,   # Reefer compressor fuel
    "ecommerce": 1.00,
    "textile": 0.95,
    "default": 1.00,
}


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class PricingEngine:
    """
    V1 deterministic pricing engine.

    Formula:
        base_freight   = weight_tons × distance_km × base_rate × truck_multiplier
        fuel_surcharge = base_freight × fuel_pct × load_fuel_modifier
        toll_estimate  = (distance_km / 100) × toll_per_100km
        deadhead_cost  = deadhead_km × penalty_per_km
        urgency_premium= base_freight × urgency_pct (if urgent)
        platform_fee   = gross_payout × platform_fee_pct
        gross_payout   = base_freight + fuel_surcharge + toll_estimate + urgency_premium
        net_payout     = gross_payout - deadhead_cost - platform_fee

    V2 TODO: Replace base_rate with XGBoost model that ingests:
        - regional supply/demand ratio from Redis
        - day-of-week, season, commodity type
        - historical booking rate on this corridor
    """

    def __init__(self) -> None:
        self._base_rate = settings.BASE_RATE_PER_TON_KM
        self._fuel_pct = settings.FUEL_SURCHARGE_PERCENT
        self._platform_pct = settings.PLATFORM_FEE_PERCENT
        self._deadhead_penalty = settings.DEADHEAD_PENALTY_PER_KM
        self._urgency_pct = settings.URGENCY_PREMIUM_PERCENT
        self._toll_per_100km = settings.TOLL_RATE_PER_100KM
        logger.info("PricingEngine V1 initialised")

    # ── Public API ──────────────────────────────────────────────────────

    def calculate(
        self,
        origin_lat: float,
        origin_lng: float,
        destination_lat: float,
        destination_lng: float,
        weight_tons: float,
        deadhead_km: float,
        truck_type: str = "flatbed",
        load_type: str = "default",
        is_urgent: bool = False,
    ) -> PricingBreakdown:
        """
        Full pricing breakdown for a single load match.
        Returns PricingBreakdown with all components itemised.
        """
        distance_km = haversine_km(
            origin_lat, origin_lng, destination_lat, destination_lng
        )

        truck_mult = TRUCK_TYPE_MULTIPLIERS.get(truck_type.lower(), 1.0)
        fuel_mod = LOAD_TYPE_FUEL_MODIFIER.get(load_type.lower(), 1.0)
        toll_rate = self._get_corridor_toll(origin_lat, origin_lng, destination_lat, destination_lng)

        # Core components
        base_freight = weight_tons * distance_km * self._base_rate * truck_mult
        fuel_surcharge = base_freight * self._fuel_pct * fuel_mod
        toll_estimate = (distance_km / 100.0) * toll_rate
        urgency_premium = (base_freight * self._urgency_pct) if is_urgent else 0.0

        gross_payout = base_freight + fuel_surcharge + toll_estimate + urgency_premium
        platform_fee = gross_payout * self._platform_pct

        # Deadhead cost — this is the financial pain of the empty run
        deadhead_cost = self._calculate_deadhead_cost(deadhead_km)

        # Net payout: what the fleet owner actually receives
        net_payout = gross_payout - deadhead_cost - platform_fee

        per_km_effective = net_payout / distance_km if distance_km > 0 else 0.0

        # Driver monetization: tiered fee charged to the driver for the match
        driver_fee = self._calculate_driver_fee(max(net_payout, 0.0))

        return PricingBreakdown(
            base_freight_inr=round(base_freight, 2),
            fuel_surcharge_inr=round(fuel_surcharge, 2),
            toll_estimate_inr=round(toll_estimate, 2),
            deadhead_penalty_inr=round(deadhead_cost, 2),
            urgent_premium_inr=round(urgency_premium, 2),
            platform_fee_inr=round(platform_fee, 2),
            gross_payout_inr=round(gross_payout, 2),
            net_payout_inr=round(max(net_payout, 0.0), 2),  # Floor at 0
            per_km_effective_rate=round(per_km_effective, 3),
            distance_km=round(distance_km, 1),
            driver_match_fee_inr=driver_fee,
        )

    # ── Driver Monetization Fee ──────────────────────────────────────────

    def _calculate_driver_fee(self, net_payout: float) -> float:
        """
        Tiered access fee charged to the driver for using LoadSetu to find this load.
        Kept intentionally low to drive adoption in the unorganised sector.

        Tier 1 (small loads / short hauls): ₹99
        Tier 2 (mid-range loads):           ₹199
        Tier 3 (large loads):               ₹299
        """
        if net_payout < 10_000:
            return 99.0
        elif net_payout <= 25_000:
            return 199.0
        else:
            return 299.0

    # ── Deadhead Cost Calculator ─────────────────────────────────────────

    def _calculate_deadhead_cost(self, deadhead_km: float) -> float:
        """
        Progressive penalty for driving empty to reach the pickup point.

        Tiers:
          0-15 km   → standard penalty (driver accepts this)
          16-40 km  → 1.5× penalty (borderline)
          41-80 km  → 2.5× penalty (heavy penalty, still profitable in most cases)
          80+ km    → matching engine filters this out before we get here
        """
        if deadhead_km <= 15.0:
            return deadhead_km * self._deadhead_penalty
        elif deadhead_km <= 40.0:
            return deadhead_km * self._deadhead_penalty * 1.5
        else:
            return deadhead_km * self._deadhead_penalty * 2.5

    # ── Toll Estimation ──────────────────────────────────────────────────

    def _get_corridor_toll(
        self, lat1: float, lng1: float, lat2: float, lng2: float
    ) -> float:
        """
        Look up corridor-specific toll rate.
        Falls back to default national highway average.

        Production: Replace with NHAI toll API or pre-computed corridor table.
        """
        # Try to identify corridor by approximate location
        # This is a simplified lookup — production would use reverse geocode + table
        return self._toll_per_100km  # V1: use uniform average


# ---------------------------------------------------------------------------
# FastAPI Dependency
# ---------------------------------------------------------------------------
_pricing_instance: Optional[PricingEngine] = None


def get_pricing_engine() -> PricingEngine:
    global _pricing_instance
    if _pricing_instance is None:
        _pricing_instance = PricingEngine()
    return _pricing_instance
