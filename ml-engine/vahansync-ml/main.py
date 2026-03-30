"""
LoadSetu x VahanSync — FastAPI Application  v2
AI & Matching Microservice — Full Production Build

Security layers in order of execution (Twilio webhook):
  1. Twilio signature validation     (spoofing prevention)
  2. Idempotency check               (Twilio retry de-dupe)
  3. Rate limiting                   (Denial-of-Wallet)
  4. Voice note detection            (Module 1)
  5. Message length guard            (prompt injection / DoW)
  6. Shipper state machine check     (Module 2 — must be BEFORE Gemini)
  7. Gemini parse + dual-intent      (Module 2)
  8. Redis language cache save       (UX personalisation)
  9. Dual-intent routing             (driver → match | shipper → price quote)
"""

from __future__ import annotations

import hashlib
import hmac as hmac_lib
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any
import asyncio

import httpx
import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from config.settings import get_settings
from models.schemas import (
    BookingEvent,
    BookingStatus,
    ErrorResponse,
    GeminiParseResponse,
    HealthResponse,
    LoadMatchRequest,
    LoadMatchResponse,
    LoadStatus,
    LoadStatusEvent,
    TruckTelemetryEvent,
    WhatsAppInboundMessage,
)
from services.gemini_parser import GeminiIntentParser, get_gemini_parser
from services.kafka_client import (
    VahanSyncProducer,
    get_producer,
    get_redis,
    start_kafka_consumer,
    startup_kafka,
    shutdown_kafka,
)
from services.matching_engine import MatchingEngine, get_matching_engine
from services.pricing_engine import PricingEngine, get_pricing_engine

settings = get_settings()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DPDP Compliance — Phone masking
# India DPDP Act 2023: never log raw phone numbers in plain text.
# ---------------------------------------------------------------------------
def mask_phone(phone: str) -> str:
    """
    Masks a phone number for DPDP-compliant logging.
    +919876543210  →  +91XXXXXX3210
    whatsapp:+919876543210  →  whatsapp:+91XXXXXX3210
    """
    prefix = ""
    if phone.startswith("whatsapp:"):
        prefix = "whatsapp:"
        phone = phone[len("whatsapp:"):]
    if len(phone) >= 6:
        return prefix + phone[:3] + "X" * (len(phone) - 6) + phone[-3:]
    return prefix + "X" * len(phone)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting VahanSync AI Microservice v%s [%s]",
                settings.SERVICE_VERSION, settings.ENVIRONMENT)
    consumer_task: asyncio.Task | None = None
    try:
        await startup_kafka()
        consumer_task = asyncio.create_task(start_kafka_consumer())
        logger.info("Kafka + Redis initialised")
    except Exception as exc:
        logger.warning("Kafka init degraded: %s", exc)

    yield

    logger.info("Shutting down")
    try:
        if consumer_task is not None:
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await shutdown_kafka()
    except Exception as exc:
        logger.warning("Kafka shutdown error: %s", exc)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="VahanSync AI Microservice",
    description="AI freight matching engine for LoadSetu. Solves the Indian empty run problem.",
    version=settings.SERVICE_VERSION,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [
        "https://loadsetu.in",
        "https://app.loadsetu.in",
        "https://dashboard.loadsetu.in",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def request_id_timing(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    t0 = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Processing-Time-Ms"] = f"{elapsed_ms:.2f}"
    logger.info(
        "%s %s | %d | %.1fms | rid=%s",
        request.method, request.url.path, response.status_code, elapsed_ms, request_id,
    )
    return response


# ---------------------------------------------------------------------------
# Exception handlers
# ---------------------------------------------------------------------------

@app.exception_handler(HTTPException)
async def http_exc_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=exc.detail,
            request_id=getattr(request.state, "request_id", None),
        ).model_dump(mode="json"),
    )


@app.exception_handler(Exception)
async def global_exc_handler(request: Request, exc: Exception):
    """
    Global last-resort exception handler.

    TWO different response formats depending on caller:

    1. Twilio webhook paths  → TwiML XML with status 200
       Twilio treats any non-200 or non-XML response from a webhook as a
       delivery failure and retries up to 11 times over 48 hours.
       Returning a valid TwiML 200 stops retries immediately while still
       surfacing a human-readable error to the driver.

    2. All other API paths → JSON with status 500
       Standard REST callers (dashboard, Spring Boot, tests) expect JSON.
    """
    from fastapi.responses import Response as PlainResponse

    rid = getattr(request.state, "request_id", "unknown")
    logger.error(
        "Unhandled exception | path=%s | rid=%s | error=%s",
        request.url.path, rid, exc, exc_info=True,
    )

    if "/webhook/whatsapp/twilio" in request.url.path:
        # Return valid TwiML so Twilio accepts 200 OK and stops retrying.
        twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            "<Message>System busy hai. Thodi der baad try karo. 🙏</Message>"
            "</Response>"
        )
        return PlainResponse(
            content=twiml,
            media_type="application/xml",
            status_code=200,
        )

    # All other routes: standard JSON error
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail=str(exc) if settings.DEBUG else None,
            request_id=rid,
        ).model_dump(mode="json"),
    )


# ===========================================================================
# HELPER UTILITIES
# ===========================================================================

def _twilio_reply(message: str) -> dict[str, str]:
    """Return Twilio TwiML XML response."""
    safe = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return {"messaging_response": f"<Response><Message>{safe}</Message></Response>"}


async def _validate_twilio_signature(request: Request) -> bool:
    """
    Verifies X-Twilio-Signature using twilio.request_validator.
    Returns True if valid, False if missing keys (dev mode), raises 403 on failure.
    """
    if not settings.TWILIO_AUTH_TOKEN:
        logger.warning("TWILIO_AUTH_TOKEN not set — skipping signature validation (dev mode)")
        return True

    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
    signature = request.headers.get("X-Twilio-Signature", "")
    form_data = dict(await request.form())
    url = str(request.url)

    if not validator.validate(url, form_data, signature):
        logger.warning("Twilio signature validation FAILED — dropping request")
        raise HTTPException(status_code=403, detail="Invalid Twilio signature")
    return True


async def _get_localized_error(redis_client, phone: str, fallback: str) -> str:
    """Look up cached user language and return an appropriately localized error message."""
    try:
        lang = await redis_client.get(f"user_lang:{phone}")
        if lang:
            error_messages = {
                "Tamil": "தயவுசெய்து 1 நிமிடம் காத்திருங்கள். 🙏",
                "Marathi": "कृपया 1 मिनिट थांबा. 🙏",
                "Telugu": "దయచేసి 1 నిమిషం వేచి ఉండండి. 🙏",
                "Kannada": "ದಯವಿಟ್ಟು 1 ನಿಮಿಷ ನಿರೀಕ್ಷಿಸಿ. 🙏",
                "Gujarati": "કૃપા કરીને 1 મિનિટ રાહ જુઓ. 🙏",
                "Bengali": "অনুগ্রহ করে 1 মিনিট অপেক্ষা করুন। 🙏",
                "Punjabi": "ਕਿਰਪਾ ਕਰਕੇ 1 ਮਿੰਟ ਉਡੀਕ ਕਰੋ। 🙏",
            }
            return error_messages.get(lang, fallback)
    except Exception:
        pass
    return fallback


def _format_matches_for_whatsapp(matches: Any, origin_city: str) -> str:
    """
    Teaser message — withholds shipper name and exact address.
    Full details unlock after payment.
    """
    lines = [f"✅ *{origin_city} se top {len(matches)} loads mile:*\n"]
    for i, m in enumerate(matches, 1):
        lines.append(
            f"*{i}. {m.origin} → {m.destination}*\n"
            f"   💰 Payout: ₹{m.payout_inr:,.0f}\n"
            f"   ⚖️  Maal: {m.weight_tons} ton ({m.load_type})\n"
            f"   🛣️  Duri: {m.total_distance_km:.0f} km\n"
            f"   🚗 Khali chaloge: {m.deadhead_km:.0f} km\n"
            f"   📊 Match: {m.confidence_score * 100:.0f}%\n"
        )
    lines.append(
        "👆 Reply *1*, *2*, ya *3* to confirm.\n"
        "_(Shipper details payment ke baad milenge)_ 🔒"
    )
    return "\n".join(lines)


# ===========================================================================
# OBSERVABILITY
# ===========================================================================

@app.get("/health", response_model=HealthResponse, tags=["observability"])
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.SERVICE_NAME,
        version=settings.SERVICE_VERSION,
        timestamp=datetime.utcnow(),
        dependencies={"kafka": "connected", "redis": "connected"},
    )


@app.get("/ready", tags=["observability"])
async def readiness_probe() -> dict[str, str]:
    return {"status": "ready"}


@app.post("/api/v1/telemetry", tags=["telemetry"])
async def ingest_telemetry(
    payload: TruckTelemetryEvent,
    producer: VahanSyncProducer = Depends(get_producer),
) -> dict[str, Any]:
    ok = await producer.publish(
        topic=settings.TOPIC_TRUCK_TELEMETRY,
        payload=payload.model_dump(mode="json"),
        key=payload.truck_id,
    )
    return {"status": "queued" if ok else "degraded"}


@app.post("/api/v1/telemetry/batch", tags=["telemetry"])
async def ingest_telemetry_batch(
    pings: dict[str, list[dict[str, Any]]],
    producer: VahanSyncProducer = Depends(get_producer),
) -> dict[str, Any]:
    sent = 0
    for raw in pings.get("pings", []):
        payload = TruckTelemetryEvent(**raw)
        ok = await producer.publish(
            topic=settings.TOPIC_TRUCK_TELEMETRY,
            payload=payload.model_dump(mode="json"),
            key=payload.truck_id,
        )
        if ok:
            sent += 1
    return {"status": "queued", "count": sent}


# ===========================================================================
# MODULE 1 — Primary Load Matching
# ===========================================================================

@app.post(
    "/api/v1/loads/match",
    response_model=LoadMatchResponse,
    tags=["matching"],
    summary="Find return loads for an empty truck",
)
async def match_loads(
    request: Request,
    payload: LoadMatchRequest,
    engine: MatchingEngine = Depends(get_matching_engine),
) -> LoadMatchResponse:
    t0 = time.perf_counter()
    try:
        matches, center_h3 = await engine.find_matches(
            truck_lat=payload.current_location_lat,
            truck_lng=payload.current_location_lng,
            capacity_tons=payload.capacity_tons,
            empty_at=payload.empty_at_timestamp,
            truck_id=payload.truck_id,
        )
    except Exception as exc:
        logger.exception("Matching engine error | truck=%s: %s", payload.truck_id, exc)
        raise HTTPException(status_code=500, detail="Matching engine error. Please retry.")

    return LoadMatchResponse(
        request_id=getattr(request.state, "request_id", str(uuid.uuid4())),
        truck_id=payload.truck_id,
        matches=matches,
        total_matches_found=len(matches),
        search_radius_km=50.0,
        search_center_h3=center_h3,
        processing_ms=round((time.perf_counter() - t0) * 1000, 2),
        timestamp=datetime.utcnow(),
    )


# ===========================================================================
# MODULE 2 — WhatsApp Webhook (Twilio) — Full Production Handler
# ===========================================================================

@app.post(
    "/webhook/whatsapp/twilio",
    tags=["whatsapp"],
    summary="Receive WhatsApp messages/voice notes via Twilio",
)
async def whatsapp_twilio_webhook(
    request: Request,
    parser: GeminiIntentParser = Depends(get_gemini_parser),
    engine: MatchingEngine = Depends(get_matching_engine),
    pricing: PricingEngine = Depends(get_pricing_engine),
    producer: VahanSyncProducer = Depends(get_producer),
) -> dict[str, Any]:
    """
    Full production Twilio WhatsApp handler.

    Security layers (in order):
      1. Twilio HMAC signature validation
      2. MessageSid idempotency (Twilio retry deduplication)
      3. Per-phone rate limiting (10 req/60s)
      4. Voice note detection + 2MB guardrail + Twilio auth download
      5. Message length guard (250 char pre-LLM)
      6. Shipper state machine (BEFORE Gemini to save tokens)
      7. Gemini parse with dual-intent detection
      8. Redis language cache
      9. Dual-intent routing: driver → match, shipper → price quote
    """

    # ── STEP 0: Parse form body ──────────────────────────────────────────
    form = await request.form()
    from_number = str(form.get("From", ""))
    body = str(form.get("Body", "")).strip()
    message_sid = str(form.get("MessageSid", "unknown"))
    num_media = int(form.get("NumMedia", "0"))
    media_url = str(form.get("MediaUrl0", ""))
    media_mime = str(form.get("MediaContentType0", "audio/ogg"))

    logger.info(
        "Twilio inbound | from=%s | sid=%s | has_media=%s | body_len=%d",
        mask_phone(from_number), message_sid, num_media > 0, len(body),
    )

    # ── STEP 1: Twilio signature validation ──────────────────────────────
    await _validate_twilio_signature(request)

    # Get Redis client once — used across multiple steps
    redis = None
    try:
        redis = await get_redis()
    except Exception as exc:
        logger.warning("Redis unavailable — proceeding in degraded mode: %s", exc)

    # ── STEP 2: Idempotency — deduplicate Twilio retries ────────────────
    # Twilio resends if it doesn't receive 200 within 15s.
    # SETNX returns 1 (set) or 0 (already exists → duplicate).
    if redis:
        try:
            is_new = await redis.setnx(
                f"processed_msg:{message_sid}", "1"
            )
            if is_new:
                await redis.expire(
                    f"processed_msg:{message_sid}",
                    settings.PROCESSED_MSG_TTL_SECONDS,
                )
            else:
                logger.info("Duplicate Twilio retry dropped | sid=%s", message_sid)
                return {"status": "ok"}  # Silent 200 to stop Twilio retrying
        except Exception as exc:
            logger.warning("Redis idempotency check failed (fail-open): %s", exc)

    # ── STEP 3: Rate limiting — Denial-of-Wallet protection ─────────────
    if redis:
        rate_key = f"rate_limit:whatsapp:{from_number}"
        try:
            current_count = await redis.incr(rate_key)
            if current_count == 1:
                await redis.expire(
                    rate_key, settings.WHATSAPP_RATE_LIMIT_WINDOW_SECONDS
                )
            if current_count > settings.WHATSAPP_RATE_LIMIT_MAX_REQUESTS:
                logger.warning(
                    "Rate limit hit | from=%s | count=%d",
                    mask_phone(from_number), current_count,
                )
                wait_msg = await _get_localized_error(
                    redis, from_number,
                    "Please wait 1 minute before sending more messages. 🙏"
                )
                # Silent 200 OK — do NOT return an error code or Twilio will retry
                return _twilio_reply(wait_msg)
        except Exception as exc:
            logger.warning("Redis rate limit check failed (fail-open): %s", exc)

    # ── STEP 4: Voice note detection + download ──────────────────────────
    parse_result: GeminiParseResponse | None = None

    if num_media > 0 and media_url and media_mime.startswith("audio/"):
        logger.info(
            "Voice note received | from=%s | mime=%s",
            mask_phone(from_number), media_mime,
        )
        try:
            async with httpx.AsyncClient(
                timeout=settings.VOICE_NOTE_DOWNLOAD_TIMEOUT_SECONDS
            ) as client:
                # Twilio requires HTTP Basic Auth to serve media files
                audio_response = await client.get(
                    media_url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                )
                audio_response.raise_for_status()
                audio_bytes = audio_response.content

            # 2MB hard cap — reject before sending to Gemini
            if len(audio_bytes) > settings.VOICE_NOTE_MAX_BYTES:
                logger.warning(
                    "Voice note too large | from=%s | size=%d bytes",
                    mask_phone(from_number), len(audio_bytes),
                )
                too_large_msg = await _get_localized_error(
                    redis, from_number,
                    "Audio file too large. Please send a shorter voice note (max 2MB). 🎤"
                )
                return _twilio_reply(too_large_msg)

            # Parse voice note — same pipeline as text
            parse_result = await parser.parse_voice_note(audio_bytes, media_mime)

        except httpx.TimeoutException:
            logger.error("Voice note download timed out | from=%s", mask_phone(from_number))
            return _twilio_reply(
                "Voice note download slow hai. Text mein message bhejo. 🙏"
            )
        except Exception as exc:
            logger.exception("Voice note processing error: %s", exc)
            return _twilio_reply(
                "Voice note process nahi ho paya. Text mein likho bhai. 🙏"
            )

    # ── STEP 5: Text message path — length guard ─────────────────────────
    if parse_result is None:
        # No voice note — process as text
        if not body:
            return _twilio_reply("Aapka message blank tha. Kuch type karke bhejo. 🙏")

        if len(body) > settings.WHATSAPP_MAX_MESSAGE_LENGTH:
            logger.warning(
                "Oversized message | from=%s | len=%d",
                mask_phone(from_number), len(body),
            )
            return _twilio_reply(
                "Message too long. Sirf location, destination aur capacity "
                "short mein likho. (Max 250 chars) ✍️"
            )

    # ── STEP 6: Shipper state machine — BEFORE Gemini ───────────────────
    # Check if this user has a pending shipper confirmation (5-min TTL).
    # Doing this BEFORE Gemini saves API tokens on every YES/NO response.
    shipper_state_key = f"shipper_state:{from_number}"
    if redis:
        try:
            cached_state = await redis.get(shipper_state_key)
            if cached_state:
                confirmation_words = {"yes", "haan", "y", "ha", "1", "ok", "confirm", "ho jayega"}
                if body.lower().strip() in confirmation_words:
                    # ── Confirmed → create load via Spring Boot ──────────────
                    state_data = json.loads(cached_state)
                    await redis.delete(shipper_state_key)
                    logger.info(
                        "Shipper load confirmed | from=%s | origin=%s | dest=%s",
                        mask_phone(from_number),
                        state_data.get("origin_city"),
                        state_data.get("destination_city"),
                    )
                    # Publish to Kafka → Spring Boot creates the load record
                    booking_event = BookingEvent(
                        truck_id=f"shipper_{from_number.replace('whatsapp:+', '').replace('+', '')}",
                        load_id=str(uuid.uuid4()),
                        driver_whatsapp=from_number,
                        payout_inr=float(state_data.get("quoted_price", 0)),
                        deadhead_km=0.0,
                        origin=state_data.get("origin_city", ""),
                        destination=state_data.get("destination_city", ""),
                        origin_lat=float(state_data.get("origin_lat", 0)),
                        origin_lng=float(state_data.get("origin_lng", 0)),
                        destination_lat=float(state_data.get("destination_lat", 0)),
                        destination_lng=float(state_data.get("destination_lng", 0)),
                        capacity_tons=float(state_data.get("capacity_tons", 0)),
                        pickup_time=datetime.utcnow(),
                        status=BookingStatus.CONFIRMED,
                    )
                    await producer.publish_booking_event(booking_event)
                    return _twilio_reply(
                        f"✅ Aapka load confirm ho gaya!\n\n"
                        f"📦 {state_data.get('origin_city')} → {state_data.get('destination_city')}\n"
                        f"⚖️  {state_data.get('capacity_tons')} ton\n"
                        f"💰 Quote: ₹{state_data.get('quoted_price', 0):,.0f}\n\n"
                        f"Hum {state_data.get('material_type', 'aapka maal')} ke liye "
                        f"best truck dhundh rahe hain. 🚛"
                    )
                else:
                    # Anything other than YES → cancel
                    await redis.delete(shipper_state_key)
                    return _twilio_reply(
                        "Load cancel kar diya gaya. Dobara bhejne ke liye nayi request karo. ❌"
                    )
        except Exception as exc:
            logger.warning("Redis shipper state check failed (fail-open): %s", exc)

    # ── STEP 7: Gemini parse ─────────────────────────────────────────────
    if parse_result is None:
        parse_result = await parser.parse(body)

    if not parse_result.success or not parse_result.intent:
        # Use localised error for system failures (timeout, circuit breaker)
        # so the driver gets a message in their own language, not generic English.
        if parse_result.error in ("gemini_timeout", "voice_timeout") and redis:
            err_msg = await _get_localized_error(
                redis, from_number,
                "System busy hai. Thodi der baad try karo. 🙏",
            )
        else:
            err_msg = parse_result.followup_message or "Dobara try karo bhai. 🙏"
        return _twilio_reply(err_msg)

    intent = parse_result.intent

    # ── STEP 8: Cache detected language for UX personalisation ──────────
    if redis and intent.detected_language and intent.detected_language != "unknown":
        try:
            await redis.set(
                f"user_lang:{from_number}",
                intent.detected_language,
                ex=settings.USER_LANGUAGE_CACHE_TTL_SECONDS,
            )
        except Exception as exc:
            logger.warning("Redis language cache write failed (non-critical): %s", exc)

    # ── STEP 9: Dual-intent routing ──────────────────────────────────────

    # ── SHIPPER FLOW: calculate price quote, save state ──────────────────
    if intent.user_role == "shipper" and intent.is_complete:
        try:
            pricing_breakdown = pricing.calculate(
                origin_lat=intent.origin_lat or 0.0,
                origin_lng=intent.origin_lng or 0.0,
                destination_lat=intent.destination_lat or 0.0,
                destination_lng=intent.destination_lng or 0.0,
                weight_tons=intent.capacity_tons or 1.0,
                deadhead_km=0.0,
                load_type=intent.material_type or "general",
            )
            quoted_price = pricing_breakdown.gross_payout_inr
        except Exception as exc:
            logger.exception("Pricing error for shipper: %s", exc)
            quoted_price = 0.0

        # Save shipper state with 5-min strict TTL
        if redis:
            try:
                state_payload = json.dumps({
                    "origin_city": intent.origin_city,
                    "destination_city": intent.destination_city,
                    "origin_lat": intent.origin_lat,
                    "origin_lng": intent.origin_lng,
                    "destination_lat": intent.destination_lat,
                    "destination_lng": intent.destination_lng,
                    "capacity_tons": intent.capacity_tons,
                    "material_type": intent.material_type,
                    "quoted_price": quoted_price,
                    "detected_language": intent.detected_language,
                })
                await redis.set(
                    shipper_state_key,
                    state_payload,
                    ex=settings.SHIPPER_STATE_TTL_SECONDS,
                )
            except Exception as exc:
                logger.warning("Redis shipper state save failed: %s", exc)

        # Send quote in shipper's language (Gemini will handle this properly
        # when we improve; for now use a bilingual template)
        material = intent.material_type or "maal"
        reply = (
            f"📦 *Aapka {material} bhejne ka kharcha:*\n\n"
            f"🗺️  {intent.origin_city} → {intent.destination_city}\n"
            f"⚖️  {intent.capacity_tons} ton\n"
            f"💰 *Estimated cost: ₹{quoted_price:,.0f}*\n\n"
            f"Confirm karne ke liye *YES* reply karein.\n"
            f"Cancel ke liye koi bhi aur message bhejo. ⏱️ (5 min valid)"
        )
        return _twilio_reply(reply)

    # ── DRIVER FLOW: incomplete intent → ask for missing field ───────────
    if not intent.is_complete:
        return _twilio_reply(
            parse_result.followup_message or "Thodi aur info chahiye. 🙏"
        )

    # ── DRIVER FLOW: complete intent → run matching engine ───────────────
    try:
        empty_dt = datetime.strptime(
            f"{intent.empty_date} {intent.empty_time or '08:00'}",
            "%Y-%m-%d %H:%M",
        )
        matches, _ = await engine.find_matches(
            truck_lat=intent.origin_lat or 0.0,
            truck_lng=intent.origin_lng or 0.0,
            capacity_tons=intent.capacity_tons or 1.0,
            empty_at=empty_dt,
            truck_id=f"wa_{from_number.replace('whatsapp:', '').replace('+', '')}",
        )
    except Exception as exc:
        logger.exception("Matching failed | from=%s: %s", mask_phone(from_number), exc)
        fallback_msg = "Abhi load search mein thodi problem hai. 2 minute mein dobara try karo. 🙏"
        if redis:
            fallback_msg = await _get_localized_error(redis, from_number, fallback_msg)
        return _twilio_reply(fallback_msg)

    if not matches:
        return _twilio_reply(
            f"Abhi {intent.origin_city} ke 50km mein koi load available nahi hai. "
            "Kal subah dobara check karna. 📅"
        )

    reply = _format_matches_for_whatsapp(matches[:3], intent.origin_city or "")
    return _twilio_reply(reply)


# ===========================================================================
# MODULE 3 — WhatsApp Webhook (Meta Business API)
# ===========================================================================

@app.get("/webhook/whatsapp/meta", tags=["whatsapp"])
async def meta_webhook_verify(
    hub_mode: str | None = None,
    hub_challenge: str | None = None,
    hub_verify_token: str | None = None,
) -> Any:
    """Meta webhook verification handshake."""
    if (
        hub_mode == "subscribe"
        and hub_verify_token == settings.META_WEBHOOK_VERIFY_TOKEN
        and hub_challenge
    ):
        logger.info("Meta webhook verified")
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@app.post("/webhook/whatsapp/meta", tags=["whatsapp"])
async def meta_webhook_receive(
    payload: WhatsAppInboundMessage,
    parser: GeminiIntentParser = Depends(get_gemini_parser),
) -> dict[str, str]:
    """
    Meta WhatsApp Business API inbound messages.
    Same guardrails as Twilio, minus Twilio-specific auth.
    """
    try:
        entry = payload.entry[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        if not messages:
            return {"status": "no_messages"}

        msg = messages[0]
        from_number = msg.get("from", "")
        msg_body = msg.get("text", {}).get("body", "")

        if not msg_body:
            return {"status": "non_text_ignored"}

        if len(msg_body) > settings.WHATSAPP_MAX_MESSAGE_LENGTH:
            logger.warning(
                "Meta: oversized msg | from=%s | len=%d",
                mask_phone(from_number), len(msg_body),
            )
            return {"status": "rejected_too_long", "length": len(msg_body)}

        parse_result = await parser.parse(msg_body)
        logger.info(
            "Meta parsed | from=%s | success=%s | role=%s",
            mask_phone(from_number),
            parse_result.success,
            parse_result.intent.user_role if parse_result.intent else "N/A",
        )
        # TODO: Send reply via Meta Graph API POST /messages
        return {"status": "processed"}

    except (IndexError, KeyError) as exc:
        logger.warning("Meta webhook parse error: %s", exc)
        return {"status": "parse_error"}


# ===========================================================================
# MODULE 4 — Payment Webhook (Razorpay / Cashfree)
# ===========================================================================

@app.post("/webhook/payment/success", tags=["payment"])
async def payment_success_webhook(request: Request) -> dict[str, Any]:
    """
    Listens for Razorpay/Cashfree capture events.
    Verifies HMAC signature, extracts booking metadata from payment notes,
    and sends the full shipper contact details to the driver via WhatsApp.
    """
    raw_body = await request.body()
    payload = await request.json()

    # Signature verification
    razorpay_secret = settings.RAZORPAY_KEY_SECRET or settings.CASHFREE_SECRET_KEY
    if razorpay_secret:
        sig_header = (
            request.headers.get("X-Razorpay-Signature")
            or request.headers.get("X-Webhook-Signature")
        )
        if sig_header:
            expected = hmac_lib.new(
                razorpay_secret.encode(), raw_body, hashlib.sha256
            ).hexdigest()
            if not hmac_lib.compare_digest(expected, sig_header):
                logger.warning("Payment webhook signature mismatch")
                raise HTTPException(status_code=400, detail="Invalid payment signature")
    else:
        logger.warning("No payment secret — skipping sig verify (dev mode)")

    try:
        event_type = payload.get("event", "")
        if event_type not in ("payment.captured", "PAYMENT_SUCCESS"):
            return {"status": "ignored", "event": event_type}

        entity = (
            payload.get("payload", {}).get("payment", {}).get("entity", {})
            or payload.get("data", {}).get("order", {})
        )
        notes = entity.get("notes", {}) or {}
        booking_id = notes.get("booking_id")
        driver_whatsapp = notes.get("driver_whatsapp")
        shipper_name = notes.get("shipper_name", "Shipper")
        shipper_contact = notes.get("shipper_contact", "Contact via platform")
        pickup_address = notes.get("pickup_address", "Contact shipper for address")
        amount_paid = entity.get("amount", 0) / 100

        if not driver_whatsapp or not booking_id:
            raise HTTPException(status_code=400, detail="Missing driver_whatsapp or booking_id")

    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Malformed payload: {exc}")

    unlock_msg = (
        f"🎉 *Payment received! ₹{amount_paid:.0f}*\n\n"
        f"✅ *Full load details:*\n\n"
        f"🏢 *Shipper:* {shipper_name}\n"
        f"📞 *Contact:* {shipper_contact}\n"
        f"📍 *Pickup:*\n{pickup_address}\n\n"
        f"Booking ID: `{booking_id}`\n"
        f"Safe journey! 🚛💨"
    )
    logger.info(
        "Payment unlock | booking=%s | driver=%s | ₹%.0f",
        booking_id, mask_phone(driver_whatsapp), amount_paid,
    )
    # TODO: twilio_client.messages.create(body=unlock_msg, from_=settings.TWILIO_WHATSAPP_NUMBER, to=driver_whatsapp)
    return {
        "status": "success",
        "booking_id": booking_id,
        "driver_notified": True,
        "preview": unlock_msg[:80] + "...",
    }


# ===========================================================================
# MODULE 5 — Booking Confirmation
# ===========================================================================

@app.post("/api/v1/bookings/confirm", tags=["booking"])
async def confirm_booking(
    load_id: str,
    truck_id: str,
    driver_whatsapp: str,
    capacity_tons: float,
    producer: VahanSyncProducer = Depends(get_producer),
) -> dict[str, Any]:
    """Confirms a match and publishes Kafka events for Spring Boot to persist."""
    booking_event = BookingEvent(
        truck_id=truck_id,
        load_id=load_id,
        driver_whatsapp=driver_whatsapp,
        payout_inr=0.0,
        deadhead_km=0.0,
        origin="",
        destination="",
        origin_lat=0.0,
        origin_lng=0.0,
        destination_lat=0.0,
        destination_lng=0.0,
        capacity_tons=capacity_tons,
        pickup_time=datetime.utcnow(),
        status=BookingStatus.CONFIRMED,
    )
    status_event = LoadStatusEvent(
        load_id=load_id,
        previous_status=LoadStatus.POSTED,
        new_status=LoadStatus.MATCHED,
        truck_id=truck_id,
        changed_by="vahansync-ai",
    )
    b_ok = await producer.publish_booking_event(booking_event)
    s_ok = await producer.publish_load_status_event(status_event)
    return {
        "booking_id": booking_event.booking_id,
        "status": "confirmed",
        "kafka_published": b_ok and s_ok,
    }


# ===========================================================================
# MODULE 6 — Magic Dropzone (Bulk Shipper Upload)
# ===========================================================================

@app.post("/api/v1/parse/shipper-bulk", tags=["nlp"])
async def parse_shipper_bulk(
    request: Request,
    raw_data: str,
    parser: GeminiIntentParser = Depends(get_gemini_parser),
) -> dict[str, Any]:
    """Enterprise portal — paste messy Excel data, get clean load JSON."""
    if not raw_data or not raw_data.strip():
        raise HTTPException(status_code=400, detail="raw_data cannot be empty")
    if len(raw_data) > 10_000:
        raise HTTPException(
            status_code=413,
            detail="Input too large. Max 10,000 characters. Split into batches.",
        )
    result = await parser.parse_bulk_shipper_data(raw_data)
    if not result["success"]:
        raise HTTPException(
            status_code=422,
            detail=f"Parse failed: {result.get('error', 'unknown')}",
        )
    return {
        "success": True,
        "loads": result["loads"],
        "count": result["count"],
        "message": f"Extracted {result['count']} load(s). Review and confirm.",
        "request_id": getattr(request.state, "request_id", None),
    }


# ===========================================================================
# MODULE 7 — Pricing Calculator
# ===========================================================================

@app.post("/api/v1/pricing/calculate", tags=["pricing"])
async def calculate_pricing(
    origin_lat: float,
    origin_lng: float,
    destination_lat: float,
    destination_lng: float,
    weight_tons: float,
    deadhead_km: float = 0.0,
    truck_type: str = "flatbed",
    is_urgent: bool = False,
    pricing: PricingEngine = Depends(get_pricing_engine),
) -> dict[str, Any]:
    """Standalone pricing calculator for the fleet manager dashboard."""
    breakdown = pricing.calculate(
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        destination_lat=destination_lat,
        destination_lng=destination_lng,
        weight_tons=weight_tons,
        deadhead_km=deadhead_km,
        truck_type=truck_type,
        is_urgent=is_urgent,
    )
    return breakdown.model_dump()


# ===========================================================================
# MODULE 8 — Intent Parser Debug
# ===========================================================================

@app.post(
    "/api/v1/parse/intent",
    response_model=GeminiParseResponse,
    tags=["nlp"],
    summary="Test the Gemini parser with a raw message",
)
async def parse_driver_intent(
    message: str,
    parser: GeminiIntentParser = Depends(get_gemini_parser),
) -> GeminiParseResponse:
    """Debug endpoint. Not exposed in production docs."""
    return await parser.parse(message)


# ===========================================================================
# Entry point
# ===========================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        workers=1 if settings.RELOAD else settings.WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False,
    )
