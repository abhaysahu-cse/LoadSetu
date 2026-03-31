"""
LoadSetu x VahanSync — Centralised Configuration
All settings loaded from environment variables via pydantic-settings.
"""

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Service identity ──────────────────────────────────────────────────
    SERVICE_NAME: str = "vahansync-ai-microservice"
    SERVICE_VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ── Server ────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    RELOAD: bool = False

    # ── Google Gemini ─────────────────────────────────────────────────────
    GEMINI_API_KEY: str = Field(..., description="Google Generative AI API key")
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_MAX_OUTPUT_TOKENS: int = 500      # Reduced: enough for structured JSON, saves cost
    GEMINI_TEMPERATURE: float = 0.1
    GEMINI_HARD_TIMEOUT_SECONDS: int = 10   # Hard asyncio timeout per Gemini call
    GEMINI_MAX_RETRIES: int = 2             # tenacity: max 2 retries, 1s backoff

    # ── PostgreSQL (asyncpg) ──────────────────────────────────────────────
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://vahansync:secret@localhost:5432/vahansync_db"
    )
    DB_POOL_MIN_SIZE: int = 5
    DB_POOL_MAX_SIZE: int = 20
    DB_COMMAND_TIMEOUT: int = 30

    # ── Redis ─────────────────────────────────────────────────────────────
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    REDIS_POOL_MAX_CONNECTIONS: int = 50
    TRUCK_LOCATION_TTL_SECONDS: int = 600   # 10 minutes
    LOAD_CACHE_TTL_SECONDS: int = 300       # 5 minutes

    # ── Apache Kafka ──────────────────────────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = Field(default="localhost:9092")
    KAFKA_CONSUMER_GROUP_ID: str = "vahansync-ai-service"
    KAFKA_AUTO_OFFSET_RESET: str = "latest"
    KAFKA_SECURITY_PROTOCOL: str = "PLAINTEXT"  # SASL_SSL in production
    KAFKA_SASL_MECHANISM: Optional[str] = None
    KAFKA_SASL_USERNAME: Optional[str] = None
    KAFKA_SASL_PASSWORD: Optional[str] = None

    # ── Kafka Topics ──────────────────────────────────────────────────────
    TOPIC_TRUCK_TELEMETRY: str = "truck-telemetry-events"
    TOPIC_LOAD_EVENTS: str = "load-events"
    TOPIC_LOAD_MATCHES: str = "load-matches"
    TOPIC_BOOKING_EVENTS: str = "booking-events"
    TOPIC_LOAD_STATUS: str = "load-status-events"
    TOPIC_WHATSAPP_INBOUND: str = "whatsapp-inbound-events"
    ADMIN_EVENT_BUFFER_SIZE: int = 50

    # ── WhatsApp / Twilio ─────────────────────────────────────────────────
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_WHATSAPP_NUMBER: str = "whatsapp:+14155238886"
    WHATSAPP_MAX_MESSAGE_LENGTH: int = 250
    # Rate limiting — Denial-of-Wallet protection
    WHATSAPP_RATE_LIMIT_MAX_REQUESTS: int = 10   # Max requests per window
    WHATSAPP_RATE_LIMIT_WINDOW_SECONDS: int = 60  # 1-minute sliding window
    # Voice note security
    VOICE_NOTE_MAX_BYTES: int = 2 * 1024 * 1024  # 2MB hard cap
    VOICE_NOTE_DOWNLOAD_TIMEOUT_SECONDS: float = 5.0
    # Redis UX state TTLs
    USER_LANGUAGE_CACHE_TTL_SECONDS: int = 86400  # 24h — remember driver's language
    SHIPPER_STATE_TTL_SECONDS: int = 300           # 5-min strict TTL for shipper confirmation
    PROCESSED_MSG_TTL_SECONDS: int = 300           # 5-min idempotency window

    # ── Meta WhatsApp Business API ────────────────────────────────────────
    META_WHATSAPP_TOKEN: Optional[str] = None
    META_WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    META_WEBHOOK_VERIFY_TOKEN: Optional[str] = None

    # ── Spring Boot Backend ───────────────────────────────────────────────
    SPRING_BOOT_BASE_URL: str = Field(default="http://localhost:8080")
    SPRING_BOOT_TIMEOUT_SECONDS: float = 5.0   # Hard per-phase timeout (connect/read/write/pool)
    INTERNAL_API_SECRET: str = Field(
        default="CHANGE_ME_BEFORE_DEPLOYING",
        description="Shared secret header for Python → Spring Boot auth",
    )
    # Redis-backed circuit breaker — no global Python variables
    SPRING_BOOT_CIRCUIT_BREAKER_THRESHOLD: int = 5    # Open after this many failures
    SPRING_BOOT_CIRCUIT_BREAKER_WINDOW_SECONDS: int = 30  # Auto-reset after 30s

    # ── Razorpay / Cashfree Payment Gateway ──────────────────────────────
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    CASHFREE_APP_ID: Optional[str] = None
    CASHFREE_SECRET_KEY: Optional[str] = None

    # ── H3 Geospatial ─────────────────────────────────────────────────────
    H3_RESOLUTION: int = 7          # ~5.16 km edge length — good for city-level matching
    H3_SEARCH_RINGS: int = 3        # k-rings around center hex (3 rings ≈ 50km at res 7)
    MAX_DEADHEAD_KM: float = 80.0   # Hard cut-off: never recommend if deadhead > 80km

    # ── Pricing Engine ────────────────────────────────────────────────────
    BASE_RATE_PER_TON_KM: float = 1.85          # INR per ton per km (India market ~2025)
    FUEL_SURCHARGE_PERCENT: float = 0.12         # 12% of base freight
    PLATFORM_FEE_PERCENT: float = 0.04           # 4% of gross
    DEADHEAD_PENALTY_PER_KM: float = 8.50        # INR per empty km
    URGENCY_PREMIUM_PERCENT: float = 0.08        # 8% premium for same-day loads
    TOLL_RATE_PER_100KM: float = 120.0           # Average NH toll estimate INR/100km

    # ── Matching Engine ───────────────────────────────────────────────────
    MAX_MATCHES_RETURNED: int = 5
    MIN_CONFIDENCE_SCORE: float = 0.30
    CAPACITY_TOLERANCE_PERCENT: float = 0.10     # Allow 10% over/under capacity


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached singleton — safe to call anywhere."""
    return Settings()
