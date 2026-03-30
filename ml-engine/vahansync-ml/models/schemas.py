"""
LoadSetu x VahanSync — Pydantic Models
All request/response contracts for the AI & Matching Microservice.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TruckStatus(str, Enum):
    AVAILABLE = "available"
    EMPTY_RETURN = "empty_return"
    IN_TRANSIT = "in_transit"
    IDLE = "idle"
    MAINTENANCE = "maintenance"


class LoadStatus(str, Enum):
    POSTED = "posted"
    BIDDING = "bidding"
    MATCHED = "matched"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    PAID = "paid"


class BookingStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class WhatsAppMessageType(str, Enum):
    TEXT = "text"
    VOICE = "audio"
    IMAGE = "image"


# ---------------------------------------------------------------------------
# Core Load Matching  (PRIMARY CONTRACT)
# ---------------------------------------------------------------------------

class LoadMatchRequest(BaseModel):
    """POST /api/v1/loads/match — main matching endpoint payload."""
    truck_id: str = Field(..., description="Unique truck identifier (RC number or UUID)")
    current_location_lat: float = Field(..., ge=-90.0, le=90.0)
    current_location_lng: float = Field(..., ge=-180.0, le=180.0)
    empty_at_timestamp: datetime = Field(..., description="ISO-8601 UTC when truck becomes empty")
    capacity_tons: float = Field(..., gt=0.0, le=50.0, description="Available capacity in metric tons")

    @field_validator("truck_id")
    @classmethod
    def validate_truck_id(cls, v: str) -> str:
        v = v.strip().upper()
        if len(v) < 4:
            raise ValueError("truck_id too short — must be RC number or UUID")
        return v


class LoadMatchResult(BaseModel):
    """Single matched load returned to the caller."""
    load_id: str
    origin: str
    origin_lat: float
    origin_lng: float
    destination: str
    destination_lat: float
    destination_lng: float
    payout_inr: float = Field(..., description="Net payout after platform fee (INR)")
    gross_payout_inr: float = Field(..., description="Gross freight amount (INR)")
    platform_fee_inr: float
    deadhead_km: float = Field(..., description="Empty km to reach pickup point")
    deadhead_cost_inr: float
    total_distance_km: float
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    weight_tons: float
    load_type: str
    shipper_name: str
    time_window_start: datetime
    time_window_end: datetime
    estimated_transit_hours: float


class LoadMatchResponse(BaseModel):
    """POST /api/v1/loads/match — full response envelope."""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    matches: list[LoadMatchResult]
    total_matches_found: int
    search_radius_km: float
    search_center_h3: str
    processing_ms: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# WhatsApp / Conversational Layer
# ---------------------------------------------------------------------------

class WhatsAppInboundMessage(BaseModel):
    """Webhook payload from Meta WhatsApp Business API."""
    object: str = Field(default="whatsapp_business_account")
    entry: list[dict[str, Any]]


class TwilioInboundMessage(BaseModel):
    """Twilio WhatsApp webhook payload (form-encoded, mapped here)."""
    MessageSid: str
    From: str  # whatsapp:+91XXXXXXXXXX
    To: str
    Body: str
    NumMedia: str = "0"
    MediaUrl0: Optional[str] = None


class ParsedFreightIntent(BaseModel):
    """
    Gemini-extracted intent from driver's natural language message.

    Post-LLM guardrails are enforced here via Pydantic validators.
    If Gemini hallucinates an out-of-range number (e.g. capacity_tons=999),
    the validator raises a ValueError, which gemini_parser.py catches and
    converts into a clarification followup instead of crashing downstream.
    """
    origin_city: Optional[str] = None
    origin_lat: Optional[float] = None
    origin_lng: Optional[float] = None
    destination_city: Optional[str] = None
    destination_lat: Optional[float] = None
    destination_lng: Optional[float] = None
    empty_date: Optional[str] = None           # YYYY-MM-DD
    empty_time: Optional[str] = None           # HH:MM (24h IST)
    capacity_tons: Optional[float] = None
    payout_inr: Optional[float] = None         # Future: if driver mentions a rate
    truck_type: Optional[str] = None
    # Dual-intent: is this person a driver looking for a load, or a shipper posting one?
    user_role: Literal["driver", "shipper", "unknown"] = "unknown"
    material_type: Optional[str] = None        # Commodity the shipper wants to move
    raw_message: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    missing_fields: list[str] = Field(default_factory=list)
    is_complete: bool = False
    detected_language: Optional[str] = None
    gemini_followup: Optional[str] = None

    @field_validator("capacity_tons")
    @classmethod
    def validate_capacity_tons(cls, v: Optional[float]) -> Optional[float]:
        """
        Hard cap: no single truck in India legally carries more than 50 metric tons.
        If Gemini hallucinates a larger number (e.g. it misreads '500 km' as '500 ton'),
        reject it immediately so the driver is asked to clarify instead of the value
        propagating into the pricing engine or the database.
        """
        if v is not None and v > 50.0:
            raise ValueError(
                f"capacity_tons {v} exceeds maximum legal limit of 50 tons — "
                "Gemini hallucination detected, triggering clarification flow."
            )
        if v is not None and v <= 0:
            raise ValueError("capacity_tons must be greater than zero.")
        return v

    @field_validator("payout_inr")
    @classmethod
    def validate_payout_inr(cls, v: Optional[float]) -> Optional[float]:
        """
        Guard against hallucinated freight rates.
        ₹5,00,000 is the ceiling for any single truck load in the Indian market.
        Values above this are almost certainly a Gemini extraction error.
        """
        if v is not None and v >= 500_000:
            raise ValueError(
                f"payout_inr {v} exceeds ₹5,00,000 ceiling — "
                "Gemini hallucination detected, triggering clarification flow."
            )
        if v is not None and v < 0:
            raise ValueError("payout_inr cannot be negative.")
        return v


class GeminiParseResponse(BaseModel):
    """Internal response from Gemini parser service."""
    success: bool
    intent: Optional[ParsedFreightIntent] = None
    followup_message: Optional[str] = None  # Hinglish prompt for missing info
    error: Optional[str] = None


class ConversationalReply(BaseModel):
    """Response sent back to driver via WhatsApp."""
    to_number: str
    message_text: str
    quick_replies: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Pricing Engine
# ---------------------------------------------------------------------------

class PricingRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    weight_tons: float = Field(..., gt=0)
    deadhead_km: float = Field(..., ge=0)
    truck_type: str = "flatbed"
    is_urgent: bool = False


class PricingBreakdown(BaseModel):
    base_freight_inr: float
    fuel_surcharge_inr: float
    toll_estimate_inr: float
    deadhead_penalty_inr: float
    urgent_premium_inr: float
    platform_fee_inr: float
    gross_payout_inr: float
    net_payout_inr: float
    per_km_effective_rate: float
    distance_km: float
    driver_match_fee_inr: float = 0.0   # Tiered fee charged to driver for using the platform


# ---------------------------------------------------------------------------
# Kafka Event Schemas
# ---------------------------------------------------------------------------

class TruckTelemetryEvent(BaseModel):
    """Consumed from `truck-telemetry-events` Kafka topic."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    lat: float
    lng: float
    speed_kmh: float = 0.0
    heading_degrees: Optional[float] = None
    fuel_level_pct: Optional[float] = None
    status: TruckStatus = TruckStatus.AVAILABLE
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    driver_id: Optional[str] = None


class BookingEvent(BaseModel):
    """Published to `booking-events` Kafka topic on successful match acceptance."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str = "BOOKING_CONFIRMED"
    booking_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    truck_id: str
    load_id: str
    driver_whatsapp: str
    payout_inr: float
    deadhead_km: float
    origin: str
    destination: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    capacity_tons: float
    pickup_time: datetime
    status: BookingStatus = BookingStatus.CONFIRMED
    created_at: datetime = Field(default_factory=datetime.utcnow)
    platform_version: str = "v1.0"


class LoadStatusEvent(BaseModel):
    """Published to `load-status-events` topic on load lifecycle transitions."""
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    load_id: str
    previous_status: LoadStatus
    new_status: LoadStatus
    truck_id: Optional[str] = None
    changed_by: str = "system"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Truck & Load DB Models (for mock DB layer)
# ---------------------------------------------------------------------------

class TruckRecord(BaseModel):
    truck_id: str
    owner_id: str
    registration_number: str
    capacity_tons: float
    truck_type: str
    current_lat: float
    current_lng: float
    current_h3_index: str
    status: TruckStatus
    ulip_verified: bool = False
    insurance_valid_until: Optional[datetime] = None
    last_seen: datetime = Field(default_factory=datetime.utcnow)


class LoadRecord(BaseModel):
    load_id: str
    shipper_id: str
    shipper_name: str
    origin: str
    origin_lat: float
    origin_lng: float
    origin_h3_index: str
    destination: str
    destination_lat: float
    destination_lng: float
    weight_tons: float
    load_type: str
    base_price_inr: float
    status: LoadStatus = LoadStatus.POSTED
    time_window_start: datetime
    time_window_end: datetime
    posted_at: datetime = Field(default_factory=datetime.utcnow)


# ---------------------------------------------------------------------------
# Health & Internal
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "vahansync-ai-microservice"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    dependencies: dict[str, str] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    request_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
