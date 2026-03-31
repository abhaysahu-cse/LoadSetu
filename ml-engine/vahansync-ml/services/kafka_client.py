"""
LoadSetu x VahanSync — Kafka Event Streaming Client
Async producer + consumer for all platform events.
Uses aiokafka for non-blocking I/O compatible with FastAPI.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Optional



import redis.asyncio as aioredis
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.errors import KafkaConnectionError, KafkaError

from config.settings import get_settings
from models.schemas import (
    BookingEvent,
    LoadStatusEvent,
    TruckStatus,
    TruckTelemetryEvent,
)

logger = logging.getLogger(__name__)
settings = get_settings()


# ---------------------------------------------------------------------------
# Redis client (shared pool for location caching)
# ---------------------------------------------------------------------------

_redis_pool: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_POOL_MAX_CONNECTIONS,
            decode_responses=True,
        )
    return _redis_pool


async def close_redis() -> None:
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None


# ---------------------------------------------------------------------------
# Kafka Producer
# ---------------------------------------------------------------------------

class VahanSyncProducer:
    """
    Async Kafka producer.
    Handles serialisation, retries, and idempotency.
    """

    def __init__(self) -> None:
        self._producer: Optional[AIOKafkaProducer] = None
        self._started = False

    async def start(self) -> None:
        kafka_config: dict[str, Any] = {
            "bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "value_serializer": lambda v: json.dumps(v, default=str).encode("utf-8"),
            "key_serializer": lambda k: k.encode("utf-8") if k else None,
            "acks": "all",              # Wait for all replicas — prevents data loss
            "enable_idempotence": True, # Exactly-once semantics at producer level            "retries": 5,
            "retry_backoff_ms": 300,
            "compression_type": "gzip",
            "linger_ms": 5,             # Micro-batch for throughput
        }

        if settings.KAFKA_SECURITY_PROTOCOL != "PLAINTEXT":
            kafka_config.update({
                "security_protocol": settings.KAFKA_SECURITY_PROTOCOL,
                "sasl_mechanism": settings.KAFKA_SASL_MECHANISM,
                "sasl_plain_username": settings.KAFKA_SASL_USERNAME,
                "sasl_plain_password": settings.KAFKA_SASL_PASSWORD,
            })

        self._producer = AIOKafkaProducer(**kafka_config)
        try:
            await self._producer.start()
            self._started = True
            logger.info("Kafka producer started | brokers=%s", settings.KAFKA_BOOTSTRAP_SERVERS)
        except KafkaConnectionError as exc:
            logger.error("Kafka producer failed to start: %s", exc)
            # Don't crash the service — graceful degradation
            self._started = False

    async def stop(self) -> None:
        if self._producer and self._started:
            await self._producer.stop()
            self._started = False
            logger.info("Kafka producer stopped")

    async def publish(
        self,
        topic: str,
        payload: dict[str, Any],
        key: Optional[str] = None,
    ) -> bool:
        """
        Publish a message to a Kafka topic.
        Returns True on success, False on failure (service continues to run).
        """
        if not self._started or not self._producer:
            logger.warning("Kafka not available — event dropped | topic=%s key=%s", topic, key)
            return False

        try:
            await self._producer.send_and_wait(topic=topic, value=payload, key=key)
            logger.debug("Published to %s | key=%s", topic, key)
            return True
        except KafkaError as exc:
            logger.error("Kafka publish failed | topic=%s | error=%s", topic, exc)
            return False

    # ── Domain-specific publish methods ─────────────────────────────────

    async def publish_booking_event(self, event: BookingEvent) -> bool:
        """Publish booking confirmation to booking-events topic."""
        return await self.publish(
            topic=settings.TOPIC_BOOKING_EVENTS,
            payload=event.model_dump(mode="json"),
            key=event.booking_id,
        )

    async def publish_load_status_event(self, event: LoadStatusEvent) -> bool:
        """Publish load lifecycle state change."""
        return await self.publish(
            topic=settings.TOPIC_LOAD_STATUS,
            payload=event.model_dump(mode="json"),
            key=event.load_id,
        )


# ---------------------------------------------------------------------------
# Kafka Consumer — Truck Telemetry
# ---------------------------------------------------------------------------

class TruckTelemetryConsumer:
    """
    Consumes truck GPS pings from `truck-telemetry-events`.
    Updates Redis with latest truck location (TTL = 10 min).
    Designed to run as a background asyncio task.
    """

    def __init__(self) -> None:
        self._consumer: Optional[AIOKafkaConsumer] = None
        self._running = False

    async def start(self) -> None:
        kafka_config: dict[str, Any] = {
            "bootstrap_servers": "localhost:9092",
            "group_id": "vahansync-ml-consumer",
            "auto_offset_reset": settings.KAFKA_AUTO_OFFSET_RESET,
            # NO value_deserializer — we deserialize manually for fault tolerance
            "enable_auto_commit": True,
            "auto_commit_interval_ms": 1000,
            "session_timeout_ms": 30000,
            "heartbeat_interval_ms": 10000,
            "max_poll_records": 500,
        }

        if settings.KAFKA_SECURITY_PROTOCOL != "PLAINTEXT":
            kafka_config.update({
                "security_protocol": settings.KAFKA_SECURITY_PROTOCOL,
                "sasl_mechanism": settings.KAFKA_SASL_MECHANISM,
                "sasl_plain_username": settings.KAFKA_SASL_USERNAME,
                "sasl_plain_password": settings.KAFKA_SASL_PASSWORD,
            })

        self._consumer = AIOKafkaConsumer(
            settings.TOPIC_TRUCK_TELEMETRY,
            **kafka_config,
        )
        try:
            await self._consumer.start()
            self._running = True
            logger.info(
                "Telemetry consumer started | topic=%s", settings.TOPIC_TRUCK_TELEMETRY
            )
        except KafkaConnectionError as exc:
            logger.error("Telemetry consumer failed to start: %s", exc)

    async def stop(self) -> None:
        self._running = False
        if self._consumer:
            await self._consumer.stop()
            self._consumer = None
        logger.info("Telemetry consumer stopped")

    @staticmethod
    def _safe_deserialize(raw: bytes) -> Optional[dict[str, Any]]:
        """
        Fault-tolerant JSON deserializer.
        Returns None for empty, non-UTF8, or invalid JSON payloads.
        """
        if not raw:
            return None
        try:
            text = raw.decode("utf-8").strip()
        except (UnicodeDecodeError, AttributeError):
            logger.warning("⚠️ Skipped non-UTF8 message (%d bytes)", len(raw))
            return None
        if not text:
            return None
        try:
            parsed = json.loads(text)
            if not isinstance(parsed, dict):
                logger.warning("⚠️ Skipped non-object JSON: %s", type(parsed).__name__)
                return None
        except json.JSONDecodeError:
            logger.warning("⚠️ Skipped invalid JSON: %s", text[:120])
            return None

        # Schema enforcement — reject incomplete telemetry before it enters the pipeline
        _REQUIRED_FIELDS = ("truck_id", "lat", "lng", "status")
        if not all(f in parsed for f in _REQUIRED_FIELDS):
            logger.warning("⚠️ Invalid telemetry payload dropped (missing fields): %s", parsed)
            return None
        if not isinstance(parsed.get("lat"), (int, float)) or not isinstance(parsed.get("lng"), (int, float)):
            logger.warning("⚠️ Invalid coordinates dropped: lat=%s lng=%s", parsed.get("lat"), parsed.get("lng"))
            return None

        return parsed

    async def _consume_loop(self) -> None:
        """Main message loop — runs until _running is False. Never crashes on bad data."""
        redis = await get_redis()
        skipped = 0
        processed = 0
        while self._running:
            try:
                async for message in self._consumer:
                    if not self._running:
                        break
                    payload = self._safe_deserialize(message.value)
                    if payload is None:
                        skipped += 1
                        if skipped % 50 == 1:
                            logger.warning(
                                "⚠️ Bad messages skipped so far: %d (processed: %d)",
                                skipped, processed,
                            )
                        continue
                    await self._process_telemetry(payload, redis)
                    processed += 1
            except KafkaError as exc:
                logger.error("Kafka consumer error: %s — retrying in 5s", exc)
                await asyncio.sleep(5)
            except Exception as exc:
                logger.exception("Unexpected consumer error: %s", exc)
                await asyncio.sleep(2)

    async def _process_telemetry(
        self, payload: dict[str, Any], redis: aioredis.Redis
    ) -> None:
        """
        Process a single telemetry event:
        1. Validate payload
        2. Update Redis with truck's current location + status
        3. Update H3 index in Redis for fast geospatial queries
        """
        try:
            event = TruckTelemetryEvent(**payload)
        except Exception as exc:
            logger.warning("❌ Failed to process telemetry: %s", exc)
            return

        current_status = event.status.value if isinstance(event.status, TruckStatus) else str(event.status)
        if event.speed_kmh and event.speed_kmh > 5.0:
            if current_status.lower() == "available":
                event.status = TruckStatus.EMPTY_RETURN
                print(f"🧠 Empty run detected for truck {event.truck_id}")

        import h3 as h3lib
        try:
            cell = h3lib.latlng_to_cell(event.lat, event.lng, 7)
        except Exception as exc:
            logger.error("❌ Failed to process telemetry: %s", exc)
            return

        try:
            status_str = event.status.value if isinstance(event.status, TruckStatus) else str(event.status)
            ts_iso = event.timestamp.isoformat() if event.timestamp else datetime.utcnow().isoformat()
            ttl_seconds = 1800  # 30 min — refreshed on every telemetry ping

            pipe = redis.pipeline()

            # ── Final production schema (Java-compatible) ──────────────
            # Java reads: GET  truck:h3:{truckId}  → cell value (STRING)
            #             HGETALL truck:location:{truckId} → lat, lng, status, last_updated
            pipe.set(f"truck:h3:{event.truck_id}", cell, ex=ttl_seconds)
            pipe.hset(
                f"truck:location:{event.truck_id}",
                mapping={
                    "lat": str(event.lat),
                    "lng": str(event.lng),
                    "status": status_str,
                    "last_updated": ts_iso,
                },
            )
            pipe.expire(f"truck:location:{event.truck_id}", ttl_seconds)

            await pipe.execute()
            # TEMP: sanity log — remove once stable in production
            print(f"🧠 Stored truck:{event.truck_id} → H3:{cell} status={status_str}")
        except Exception as exc:
            logger.error("❌ Failed to process telemetry: %s", exc)


async def start_kafka_consumer() -> None:
    """Run the telemetry consumer in the background without blocking FastAPI startup."""
    global _telemetry_consumer

    if _telemetry_consumer is None:
        _telemetry_consumer = TruckTelemetryConsumer()

    while True:
        try:
            await _telemetry_consumer.start()
            if _telemetry_consumer._consumer is None:
                await asyncio.sleep(5)
                continue

            await _telemetry_consumer._consume_loop()
        except asyncio.CancelledError:
            try:
                await _telemetry_consumer.stop()
            except Exception as exc:
                logger.error("❌ Failed to process telemetry: %s", exc)
            raise
        except Exception as exc:
            logger.error("❌ Failed to process telemetry: %s", exc)
            try:
                await _telemetry_consumer.stop()
            except Exception:
                pass
            await asyncio.sleep(5)


# ---------------------------------------------------------------------------
# Global singletons (lifecycle managed by FastAPI lifespan)
# ---------------------------------------------------------------------------

_producer: Optional[VahanSyncProducer] = None
_telemetry_consumer: Optional[TruckTelemetryConsumer] = None


async def startup_kafka() -> None:
    """Call from FastAPI lifespan on startup."""
    global _producer
    _producer = VahanSyncProducer()
    await _producer.start()


async def shutdown_kafka() -> None:
    """Call from FastAPI lifespan on shutdown."""
    if _producer:
        await _producer.stop()
    await close_redis()


def get_producer() -> VahanSyncProducer:
    """FastAPI dependency — inject into route handlers."""
    if _producer is None:
        raise RuntimeError("Kafka producer not initialised. Check startup lifecycle.")
    return _producer

