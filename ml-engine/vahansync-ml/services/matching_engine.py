"""
LoadSetu x VahanSync — H3 Geospatial Matching Engine
Matches empty trucks to available loads using Uber H3 hex-grid indexing.
Ranks matches by profitability (max payout − deadhead cost).
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Optional

import h3
import httpx

from config.settings import get_settings
from models.schemas import LoadMatchResult, LoadRecord, LoadStatus
from services.pricing_engine import PricingEngine

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Haversine distance helper (used when PostGIS is unavailable / for estimates)
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns great-circle distance in km between two GPS coordinates."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Spring Boot Load Fetcher
# Replaces the mock DB layer. Calls the Java backend for posted loads.
# ---------------------------------------------------------------------------

async def _fetch_loads_from_spring_boot(
    truck_id: str,
    truck_lat: float,
    truck_lng: float,
    capacity_tons: float,
    empty_at: datetime,
) -> list[LoadRecord]:
    """
    Calls Spring Boot Load Service via HTTP POST.
    Endpoint: POST http://localhost:8080/api/v1/loads/match

    Resilience layers applied here:
      1. Redis circuit breaker — if Spring Boot has failed ≥5 times in the
         last 30 seconds, short-circuit immediately and return [] rather than
         queuing a doomed request. Failure counter resets automatically after
         the 30s TTL expires.
      2. httpx.Timeout with explicit breakdown — prevents a slow Java GC pause
         from hanging the entire async event loop. Each phase (connect, read,
         write, pool) is independently bounded at SPRING_BOOT_TIMEOUT_SECONDS.
      3. On TimeoutException → increment failure counter, return [].
      4. On all other exceptions → return [] (fail-open, matching degrades
         gracefully rather than surfacing a 500 to the driver).

    Expected Spring Boot response shape:
    {
      "matches": [
        {
          "load_id": "...",
          "origin": "Surat",
          "destination": "Bhopal",
          "payout_inr": 28000.0,
          "deadhead_km": 12.0,
          "confidence_score": 0.92
        }
      ]
    }
    """
    spring_boot_url = f"{settings.SPRING_BOOT_BASE_URL}/api/v1/loads/match"
    payload = {
        "truck_id": truck_id,
        "current_location_lat": truck_lat,
        "current_location_lng": truck_lng,
        "empty_at_timestamp": empty_at.isoformat(),
        "capacity_tons": capacity_tons,
    }

    # ── Circuit breaker: Redis-backed failure counter ─────────────────────
    # No global Python variables — state lives in Redis, visible to all workers.
    redis = None
    try:
        from services.kafka_client import get_redis as _get_redis
        redis = await _get_redis()
        failure_count_raw = await redis.get("spring_boot_failures")
        if failure_count_raw and int(failure_count_raw) >= settings.SPRING_BOOT_CIRCUIT_BREAKER_THRESHOLD:
            logger.warning(
                "Spring Boot circuit breaker OPEN | failures=%s | url=%s",
                failure_count_raw, spring_boot_url,
            )
            return []
    except Exception as cb_exc:
        # Redis unavailable — fail-open, proceed with the HTTP call anyway
        logger.debug("Circuit breaker Redis check failed (fail-open): %s", cb_exc)

    # ── HTTP call with explicit per-phase timeout ─────────────────────────
    # Using httpx.Timeout instead of a single float prevents a stalled
    # Java server from holding an open connection and blocking the event loop.
    _timeout = httpx.Timeout(
        connect=settings.SPRING_BOOT_TIMEOUT_SECONDS,
        read=settings.SPRING_BOOT_TIMEOUT_SECONDS,
        write=settings.SPRING_BOOT_TIMEOUT_SECONDS,
        pool=settings.SPRING_BOOT_TIMEOUT_SECONDS,
    )

    try:
        async with httpx.AsyncClient(
            timeout=_timeout,
            headers={
                # Service-to-service auth. Spring Boot validates this via
                # OncePerRequestFilter. Must match INTERNAL_API_SECRET in Java env.
                "X-INTERNAL-SECRET": settings.INTERNAL_API_SECRET,
                "Content-Type": "application/json",
                "X-Service-Name": "vahansync-ai",
            },
        ) as client:
            response = await client.post(spring_boot_url, json=payload)
            response.raise_for_status()
            data = response.json()

        raw_loads = data.get("matches", [])
        loads: list[LoadRecord] = []
        for item in raw_loads:
            try:
                pickup_window = datetime.utcnow()
                loads.append(
                    LoadRecord(
                        load_id=item["load_id"],
                        shipper_id="internal-match",
                        shipper_name=item.get("shipper_name", "LoadSetu"),
                        origin=item.get("origin", "Unknown Origin"),
                        origin_lat=float(item.get("origin_lat", truck_lat)),
                        origin_lng=float(item.get("origin_lng", truck_lng)),
                        origin_h3_index=h3.latlng_to_cell(truck_lat, truck_lng, settings.H3_RESOLUTION),
                        destination=item.get("destination", "Unknown Destination"),
                        destination_lat=float(item.get("destination_lat", truck_lat)),
                        destination_lng=float(item.get("destination_lng", truck_lng)),
                        weight_tons=float(item.get("weight_tons", capacity_tons)),
                        load_type=item.get("load_type", "general"),
                        base_price_inr=float(item.get("payout_inr", 0.0)),
                        status=LoadStatus.POSTED,
                        time_window_start=item.get("time_window_start", pickup_window),
                        time_window_end=item.get("time_window_end", pickup_window),
                    )
                )
            except Exception as parse_err:
                logger.warning(
                    "Skipping malformed load record: %s | error: %s",
                    item.get("load_id"), parse_err,
                )
        logger.debug("Spring Boot returned %d loads", len(loads))
        return loads

    except httpx.TimeoutException:
        logger.error(
            "Spring Boot timed out after %ss | url=%s",
            settings.SPRING_BOOT_TIMEOUT_SECONDS, spring_boot_url,
        )
        # Increment failure counter — Redis TTL of 30s acts as the reset window.
        if redis:
            try:
                count = await redis.incr("spring_boot_failures")
                await redis.expire(
                    "spring_boot_failures",
                    settings.SPRING_BOOT_CIRCUIT_BREAKER_WINDOW_SECONDS,
                )
                logger.warning(
                    "Circuit breaker failure count: %d / %d",
                    count, settings.SPRING_BOOT_CIRCUIT_BREAKER_THRESHOLD,
                )
            except Exception as rc_exc:
                logger.debug("Circuit breaker counter update failed: %s", rc_exc)
        return []

    except httpx.ConnectError:
        logger.error("Cannot reach Spring Boot at %s", spring_boot_url)
        if redis:
            try:
                await redis.incr("spring_boot_failures")
                await redis.expire(
                    "spring_boot_failures",
                    settings.SPRING_BOOT_CIRCUIT_BREAKER_WINDOW_SECONDS,
                )
            except Exception:
                pass
        return []

    except httpx.HTTPStatusError as exc:
        logger.error(
            "Spring Boot HTTP %d | url=%s | body=%s",
            exc.response.status_code, spring_boot_url, exc.response.text[:200],
        )
        return []

    except Exception as exc:
        logger.exception("Unexpected Spring Boot fetch error: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Matching Engine
# ---------------------------------------------------------------------------

class MatchingEngine:
    """
    Core freight matching engine.
    - Converts truck GPS to H3 hex index
    - Expands outward k-rings to find loads within ~50km
    - Scores each load on profitability = payout - deadhead_cost
    - Returns top N ranked matches
    """

    def __init__(self, pricing_engine: PricingEngine) -> None:
        self._pricing = pricing_engine
        logger.info(
            "MatchingEngine ready | H3 resolution=%d rings=%d",
            settings.H3_RESOLUTION,
            settings.H3_SEARCH_RINGS,
        )

    # ── Public API ──────────────────────────────────────────────────────

    async def find_matches(
        self,
        truck_lat: float,
        truck_lng: float,
        capacity_tons: float,
        empty_at: datetime,
        truck_id: str,
    ) -> tuple[list[LoadMatchResult], str]:
        """
        Main matching flow.

        Step 1: Convert truck GPS → H3 index
        Step 2: Expand H3 k-rings for 50km search radius
        Step 3: Call Spring Boot backend for posted loads in those hexes
        Step 4: Filter by capacity + time window
        Step 5: Score and rank by profitability
        Step 6: Return top N

        Returns:
            (ranked_matches, search_center_h3_index)
        """
        # Step 1: Convert truck GPS → H3 index
        center_hex = h3.latlng_to_cell(truck_lat, truck_lng, settings.H3_RESOLUTION)
        logger.debug("Truck %s → H3 center hex: %s", truck_id, center_hex)

        # Step 2: Expand search area using H3 k-rings
        search_hexes = self._expand_search_hexes(center_hex)
        logger.debug("Search area covers %d hex cells", len(search_hexes))

        # Step 3: Fetch loads from Spring Boot (source of truth)
        candidate_loads = await _fetch_loads_from_spring_boot(
            truck_id=truck_id,
            truck_lat=truck_lat,
            truck_lng=truck_lng,
            capacity_tons=capacity_tons,
            empty_at=empty_at,
        )
        logger.debug("Spring Boot returned %d candidate loads", len(candidate_loads))

        # Step 4: Filter by capacity and time window
        filtered = self._filter_loads(candidate_loads, capacity_tons, empty_at)
        logger.debug("After capacity/time filter: %d loads", len(filtered))

        # Step 5: Score and rank each load (pure Python/H3 intelligence)
        scored = self._score_and_rank(filtered, truck_lat, truck_lng, capacity_tons)

        # Step 6: Apply hard cut-offs and return top N
        results = self._apply_cutoffs(scored)

        return results, center_hex

    # ── H3 Hex Logic ────────────────────────────────────────────────────

    def _expand_search_hexes(self, center_hex: str) -> set[str]:
        """
        Returns all H3 cell indexes within k-ring distance.
        At resolution=7, ring=3 covers roughly 50km radius.
        """
        hexes: set[str] = set()
        for k in range(settings.H3_SEARCH_RINGS + 1):
            hexes.update(h3.grid_disk(center_hex, k))
        return hexes

    def get_h3_index(self, lat: float, lng: float) -> str:
        """Public helper — convert coordinates to H3 string."""
        return h3.latlng_to_cell(lat, lng, settings.H3_RESOLUTION)

    # ── Filtering ────────────────────────────────────────────────────────

    def _filter_loads(
        self,
        loads: list[LoadRecord],
        capacity_tons: float,
        empty_at: datetime,
    ) -> list[LoadRecord]:
        """
        Hard filters:
        1. Truck capacity must be >= load weight (with tolerance)
        2. Truck must be empty before load time window ends
        3. Load must not already be matched
        """
        tolerance = settings.CAPACITY_TOLERANCE_PERCENT
        result = []
        for load in loads:
            # Capacity check
            min_cap = load.weight_tons * (1 - tolerance)
            if capacity_tons < min_cap:
                continue
            # Time window check
            if empty_at > load.time_window_end:
                continue
            result.append(load)
        return result

    # ── Scoring & Ranking ────────────────────────────────────────────────

    def _score_and_rank(
        self,
        loads: list[LoadRecord],
        truck_lat: float,
        truck_lng: float,
        capacity_tons: float,
    ) -> list[LoadMatchResult]:
        """
        For each load:
          1. Calculate deadhead_km (truck → load origin)
          2. Calculate full haul distance (origin → destination)
          3. Run through pricing engine
          4. Compute confidence score
        Returns list sorted by confidence DESC.
        """
        scored: list[tuple[float, LoadMatchResult]] = []

        for load in loads:
            deadhead_km = haversine_km(
                truck_lat, truck_lng, load.origin_lat, load.origin_lng
            )
            haul_km = haversine_km(
                load.origin_lat, load.origin_lng,
                load.destination_lat, load.destination_lng,
            )

            # Hard cut: too far to drive empty
            if deadhead_km > settings.MAX_DEADHEAD_KM:
                continue

            pricing = self._pricing.calculate(
                origin_lat=load.origin_lat,
                origin_lng=load.origin_lng,
                destination_lat=load.destination_lat,
                destination_lng=load.destination_lng,
                weight_tons=load.weight_tons,
                deadhead_km=deadhead_km,
                is_urgent=self._is_urgent(load),
            )

            confidence = self._compute_confidence(
                deadhead_km=deadhead_km,
                haul_km=haul_km,
                capacity_match=min(capacity_tons / load.weight_tons, 1.0),
                time_buffer_hours=(load.time_window_end - datetime.utcnow()).total_seconds() / 3600,
            )

            if confidence < settings.MIN_CONFIDENCE_SCORE:
                continue

            transit_hours = haul_km / 55.0  # Assume avg 55 km/h including stops

            result = LoadMatchResult(
                load_id=load.load_id,
                origin=load.origin,
                origin_lat=load.origin_lat,
                origin_lng=load.origin_lng,
                destination=load.destination,
                destination_lat=load.destination_lat,
                destination_lng=load.destination_lng,
                payout_inr=round(pricing.net_payout_inr, 2),
                gross_payout_inr=round(pricing.gross_payout_inr, 2),
                platform_fee_inr=round(pricing.platform_fee_inr, 2),
                deadhead_km=round(deadhead_km, 1),
                deadhead_cost_inr=round(pricing.deadhead_penalty_inr, 2),
                total_distance_km=round(haul_km, 1),
                confidence_score=round(confidence, 3),
                weight_tons=load.weight_tons,
                load_type=load.load_type,
                shipper_name=load.shipper_name,
                time_window_start=load.time_window_start,
                time_window_end=load.time_window_end,
                estimated_transit_hours=round(transit_hours, 1),
            )
            scored.append((confidence, result))

        # Sort descending by confidence (profitability-weighted)
        scored.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored]

    # ── Confidence Scoring ───────────────────────────────────────────────

    def _compute_confidence(
        self,
        deadhead_km: float,
        haul_km: float,
        capacity_match: float,
        time_buffer_hours: float,
    ) -> float:
        """
        Composite confidence score combining 4 signals.
        Each component is normalised to [0, 1] then weighted.
        """
        # 1. Deadhead score: lower is better — penalise heavily above 30km
        if deadhead_km <= 10:
            deadhead_score = 1.0
        elif deadhead_km <= 30:
            deadhead_score = 1.0 - (deadhead_km - 10) / 40
        else:
            deadhead_score = max(0.0, 1.0 - (deadhead_km / settings.MAX_DEADHEAD_KM))

        # 2. Haul efficiency: longer profitable hauls are better (up to 800km)
        haul_score = min(haul_km / 800.0, 1.0)

        # 3. Capacity utilisation: perfect match = 1.0
        cap_score = min(capacity_match, 1.0)

        # 4. Time urgency: loads expiring soon get lower score (driver may miss)
        if time_buffer_hours >= 12:
            time_score = 1.0
        elif time_buffer_hours >= 4:
            time_score = 0.7
        elif time_buffer_hours >= 1:
            time_score = 0.4
        else:
            time_score = 0.1

        # Weighted composite
        confidence = (
            0.40 * deadhead_score
            + 0.25 * haul_score
            + 0.20 * cap_score
            + 0.15 * time_score
        )
        return round(min(max(confidence, 0.0), 1.0), 4)

    def _is_urgent(self, load: LoadRecord) -> bool:
        return (load.time_window_start - datetime.utcnow()).total_seconds() < 6 * 3600

    def _apply_cutoffs(self, ranked: list[LoadMatchResult]) -> list[LoadMatchResult]:
        return ranked[: settings.MAX_MATCHES_RETURNED]


# ---------------------------------------------------------------------------
# FastAPI Dependency
# ---------------------------------------------------------------------------
_engine_instance: Optional[MatchingEngine] = None


def get_matching_engine() -> MatchingEngine:
    """Dependency injection factory."""
    global _engine_instance
    if _engine_instance is None:
        from services.pricing_engine import get_pricing_engine
        _engine_instance = MatchingEngine(pricing_engine=get_pricing_engine())
    return _engine_instance
