from __future__ import annotations

import asyncio
import asyncpg
import json
import logging
import re
import uuid
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaConnectionError, KafkaError

from config.settings import get_settings
from models.schemas import TruckStatus, TruckTelemetryEvent
from models.stage5 import Stage5ParsedMessage
from services.kafka_client import VahanSyncProducer, get_redis

logger = logging.getLogger(__name__)
settings = get_settings()

CITY_COORDS: dict[str, tuple[str, float, float]] = {
    "bhopal": ("Bhopal", 23.2599, 77.4126),
    "indore": ("Indore", 22.7196, 75.8577),
    "jabalpur": ("Jabalpur", 23.1815, 79.9864),
    "nagpur": ("Nagpur", 21.1458, 79.0882),
    "ujjain": ("Ujjain", 23.1765, 75.7885),
    "surat": ("Surat", 21.1702, 72.8311),
    "mumbai": ("Mumbai", 19.0760, 72.8777),
    "pune": ("Pune", 18.5204, 73.8567),
    "delhi": ("Delhi", 28.6139, 77.2090),
    "jaipur": ("Jaipur", 26.9124, 75.7873),
}

_CITY_STOP_WORDS = {
    "available",
    "empty",
    "for",
    "load",
    "lorry",
    "need",
    "required",
    "truck",
    "trucks",
    "vehicle",
}


@dataclass(slots=True)
class PublishedEvent:
    topic: str
    key: str
    payload: dict[str, Any]


def resolve_city(city: Optional[str]) -> Optional[dict[str, Any]]:
    if not city:
        return None
    normalized = re.sub(r"\s+", " ", city.strip().lower())
    record = CITY_COORDS.get(normalized)
    if record is None:
        return None
    name, lat, lng = record
    return {"name": name, "lat": lat, "lng": lng}


def _database_dsn() -> str:
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def _java_hash_hex(value: str) -> str:
    hash_value = 0
    for char in value:
        hash_value = (31 * hash_value + ord(char)) & 0xFFFFFFFF
    return format(hash_value, "x")


def _generate_load_hash(
    shipper_id: str,
    origin: str,
    destination: str,
    pickup_date: str,
) -> str:
    raw = f"{shipper_id}|{origin.lower().strip()}|{destination.lower().strip()}|{pickup_date}"
    return _java_hash_hex(raw)


def _clean_city_segment(segment: str) -> Optional[str]:
    text = re.sub(r"\b\d+(?:\.\d+)?\s*(?:ton|tons|tonne|mt|kg)?\b", " ", segment, flags=re.IGNORECASE)
    text = re.sub(r"[^A-Za-z ]", " ", text)
    words = [word for word in text.split() if word.lower() not in _CITY_STOP_WORDS]
    cleaned = " ".join(words).strip()
    return cleaned.title() if cleaned else None


def parse_whatsapp_message(message: str) -> Stage5ParsedMessage:
    normalized = " ".join(message.strip().split())
    lowered = normalized.lower()

    weight_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ton|tons|tonne|mt)\b", lowered)
    weight_tons = float(weight_match.group(1)) if weight_match else None

    route_match = re.search(r"(.+?)\s+to\s+(.+)", normalized, flags=re.IGNORECASE)
    origin = None
    destination = None
    if route_match:
        origin = _clean_city_segment(route_match.group(1))
        destination = _clean_city_segment(route_match.group(2))

    load_score = 0
    driver_score = 0
    if weight_tons is not None:
        load_score += 2
    if "need truck" in lowered or "require truck" in lowered or "required truck" in lowered:
        load_score += 2
    if "load" in lowered:
        load_score += 1
    if "truck empty" in lowered or "empty truck" in lowered or "empty" in lowered:
        driver_score += 2
    if "available" in lowered:
        driver_score += 1

    if load_score > driver_score:
        parsed_type = "load"
    elif driver_score > load_score:
        parsed_type = "driver"
    elif weight_tons is not None:
        parsed_type = "load"
    elif "empty" in lowered:
        parsed_type = "driver"
    else:
        parsed_type = "unknown"

    confidence = 0.25
    if origin and destination:
        confidence += 0.4
    if weight_tons is not None and parsed_type == "load":
        confidence += 0.2
    if parsed_type in {"driver", "load"}:
        confidence += 0.15

    return Stage5ParsedMessage(
        type=parsed_type,
        origin=origin,
        destination=destination,
        weight_tons=weight_tons,
        message=normalized,
        confidence=min(confidence, 0.95),
    )


async def publish_whatsapp_event(
    parsed: Stage5ParsedMessage,
    sender: str,
    producer: VahanSyncProducer,
    message_seed: Optional[str] = None,
) -> Optional[PublishedEvent]:
    origin = resolve_city(parsed.origin)
    if origin is None:
        return None

    sender_key = sender.replace("whatsapp:", "").replace("+", "") or "unknown"
    timestamp = datetime.now(timezone.utc)

    if parsed.type == "driver":
        truck_id = str(uuid.uuid5(uuid.NAMESPACE_URL, sender_key))
        event = TruckTelemetryEvent(
            truck_id=truck_id,
            lat=origin["lat"],
            lng=origin["lng"],
            speed_kmh=0.0,
            status=TruckStatus.EMPTY_RETURN,
            timestamp=timestamp,
            driver_id=sender_key,
        )
        payload = event.model_dump(mode="json")
        ok = await producer.publish(
            topic=settings.TOPIC_TRUCK_TELEMETRY,
            payload=payload,
            key=truck_id,
        )
        if not ok:
            return None
        return PublishedEvent(settings.TOPIC_TRUCK_TELEMETRY, truck_id, payload)

    return await persist_load_and_publish_event(
        origin_city=origin["name"],
        destination_city=parsed.destination or "",
        weight_tons=parsed.weight_tons,
        producer=producer,
        reference_seed=message_seed or f"whatsapp:{sender}:{uuid.uuid4()}",
        source="whatsapp",
        sender=sender,
    )


async def persist_load_and_publish_event(
    origin_city: str,
    destination_city: str,
    weight_tons: Optional[float],
    producer: VahanSyncProducer,
    reference_seed: str,
    source: str,
    sender: Optional[str] = None,
) -> Optional[PublishedEvent]:
    origin = resolve_city(origin_city)
    destination = resolve_city(destination_city)
    if origin is None or destination is None:
        return None

    shipper_id = str(uuid.uuid5(uuid.NAMESPACE_URL, reference_seed))
    pickup_time = datetime.now(timezone.utc) + timedelta(hours=1)
    pickup_date = pickup_time.date().isoformat()
    load_hash = _generate_load_hash(shipper_id, origin["name"], destination["name"], pickup_date)
    payout_inr = round(max((weight_tons or 10.0) * 1800.0, 12000.0), 2)

    connection = await asyncpg.connect(_database_dsn())
    try:
        row = await connection.fetchrow(
            "select id::text as load_id from loads where load_hash = $1 order by created_at desc limit 1",
            load_hash,
        )
        if row is None:
            row = await connection.fetchrow(
            """
            insert into loads (
                id,
                origin_name,
                origin_geom,
                destination_name,
                destination_geom,
                required_capacity,
                payout_inr,
                pickup_time,
                status,
                shipper_id,
                load_hash,
                created_at
            )
            values (
                $1,
                $2,
                ST_SetSRID(ST_MakePoint($3, $4), 4326),
                $5,
                ST_SetSRID(ST_MakePoint($6, $7), 4326),
                $8,
                $9,
                $10,
                'AVAILABLE',
                $11,
                $12,
                NOW()
            )
            returning id::text as load_id
            """,
            uuid.uuid4(),
            origin["name"],
            origin["lng"],
            origin["lat"],
            destination["name"],
            destination["lng"],
            destination["lat"],
            min(weight_tons or 10.0, 50.0),
            payout_inr,
            pickup_time,
            uuid.UUID(shipper_id),
            load_hash,
        )
    finally:
        await connection.close()

    if row is None:
        return None

    load_id = row["load_id"]
    payload = {
        "loadId": load_id,
        "pickupLat": origin["lat"],
        "pickupLng": origin["lng"],
        "origin": origin["name"],
        "destination": destination["name"],
        "destinationLat": destination["lat"],
        "destinationLng": destination["lng"],
        "weightTons": weight_tons,
        "source": source,
        "from": sender,
        "receivedAt": datetime.now(timezone.utc).isoformat(),
    }
    ok = await producer.publish(
        topic=settings.TOPIC_LOAD_EVENTS,
        payload=payload,
        key=load_id,
    )
    if not ok:
        return None
    return PublishedEvent(settings.TOPIC_LOAD_EVENTS, load_id, payload)


async def fetch_live_trucks() -> list[dict[str, Any]]:
    redis = await get_redis()
    trucks: list[dict[str, Any]] = []
    keys = await redis.keys("truck:location:*")
    for key in keys:
        data = await redis.hgetall(key)
        if not data:
            continue
        truck_id = key.split(":")[-1]
        cell = await redis.get(f"truck:h3:{truck_id}")
        trucks.append(
            {
                "truck_id": truck_id,
                "lat": float(data.get("lat", 0.0)),
                "lng": float(data.get("lng", 0.0)),
                "status": data.get("status", "unknown"),
                "last_updated": data.get("last_updated"),
                "h3": cell,
            }
        )
    trucks.sort(key=lambda item: item.get("last_updated") or "", reverse=True)
    return trucks


class ControlPlaneMonitor:
    def __init__(self) -> None:
        self._consumer: Optional[AIOKafkaConsumer] = None
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._last_error: Optional[str] = None
        self._recent_load_events: deque[dict[str, Any]] = deque(maxlen=settings.ADMIN_EVENT_BUFFER_SIZE)
        self._recent_match_results: deque[dict[str, Any]] = deque(maxlen=settings.ADMIN_EVENT_BUFFER_SIZE)

    async def start(self) -> None:
        kafka_config: dict[str, Any] = {
            "bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "group_id": "vahansync-stage5-control-plane",
            "auto_offset_reset": "latest",
            "enable_auto_commit": True,
        }
        if settings.KAFKA_SECURITY_PROTOCOL != "PLAINTEXT":
            kafka_config.update({
                "security_protocol": settings.KAFKA_SECURITY_PROTOCOL,
                "sasl_mechanism": settings.KAFKA_SASL_MECHANISM,
                "sasl_plain_username": settings.KAFKA_SASL_USERNAME,
                "sasl_plain_password": settings.KAFKA_SASL_PASSWORD,
            })

        self._consumer = AIOKafkaConsumer(
            settings.TOPIC_LOAD_EVENTS,
            settings.TOPIC_LOAD_MATCHES,
            **kafka_config,
        )
        try:
            await self._consumer.start()
            self._running = True
            self._task = asyncio.create_task(self._consume_loop())
            logger.info(
                "Control-plane monitor started | topics=%s,%s",
                settings.TOPIC_LOAD_EVENTS,
                settings.TOPIC_LOAD_MATCHES,
            )
        except KafkaConnectionError as exc:
            self._last_error = str(exc)
            logger.warning("Control-plane monitor degraded: %s", exc)

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        if self._consumer is not None:
            await self._consumer.stop()
            self._consumer = None

    async def _consume_loop(self) -> None:
        if self._consumer is None:
            return
        try:
            async for message in self._consumer:
                if not self._running:
                    break
                payload = self._decode_payload(message.value)
                entry = {
                    "topic": message.topic,
                    "key": message.key.decode("utf-8") if isinstance(message.key, bytes) else message.key,
                    "partition": message.partition,
                    "offset": message.offset,
                    "received_at": datetime.now(timezone.utc).isoformat(),
                    "payload": payload,
                }
                if message.topic == settings.TOPIC_LOAD_EVENTS:
                    self._recent_load_events.appendleft(entry)
                else:
                    self._recent_match_results.appendleft(entry)
                    matches = payload.get("matches") if isinstance(payload, dict) else None
                    logger.info(
                        "Match returned | load_id=%s count=%s",
                        payload.get("loadId") if isinstance(payload, dict) else None,
                        len(matches) if isinstance(matches, list) else 0,
                    )
        except asyncio.CancelledError:
            raise
        except KafkaError as exc:
            self._last_error = str(exc)
            logger.warning("Control-plane monitor loop stopped: %s", exc)

    @staticmethod
    def _decode_payload(raw: bytes) -> dict[str, Any]:
        try:
            text = raw.decode("utf-8") if isinstance(raw, bytes) else str(raw)
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else {"raw": parsed}
        except Exception:
            return {"raw": raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)}

    @property
    def is_running(self) -> bool:
        return self._running and self._consumer is not None

    @property
    def last_error(self) -> Optional[str]:
        return self._last_error

    def recent_load_events(self) -> list[dict[str, Any]]:
        return list(self._recent_load_events)

    def recent_match_results(self) -> list[dict[str, Any]]:
        return list(self._recent_match_results)


_control_plane_monitor: Optional[ControlPlaneMonitor] = None


async def startup_control_plane_monitor() -> None:
    global _control_plane_monitor
    if _control_plane_monitor is None:
        _control_plane_monitor = ControlPlaneMonitor()
    await _control_plane_monitor.start()


async def shutdown_control_plane_monitor() -> None:
    global _control_plane_monitor
    if _control_plane_monitor is not None:
        await _control_plane_monitor.stop()


def get_control_plane_monitor() -> ControlPlaneMonitor:
    if _control_plane_monitor is None:
        raise RuntimeError("Control-plane monitor not initialised.")
    return _control_plane_monitor


async def collect_health_snapshot(
    producer: VahanSyncProducer,
    monitor: ControlPlaneMonitor,
) -> dict[str, Any]:
    redis = await get_redis()
    redis_status = "down"
    try:
        await redis.ping()
        redis_status = "up"
    except Exception as exc:
        logger.warning("Redis health check failed: %s", exc)

    kafka_status = "up" if getattr(producer, "_started", False) and monitor.is_running else "degraded"
    spring_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{settings.SPRING_BOOT_BASE_URL}/actuator/health")
        if response.status_code == 200:
            spring_status = response.json().get("status", "up").lower()
        else:
            spring_status = "degraded"
    except Exception:
        spring_status = "down"

    overall = "ok" if redis_status == "up" and kafka_status == "up" else "degraded"
    return {
        "status": overall,
        "dependencies": {
            "python_api": "up",
            "redis": redis_status,
            "kafka": kafka_status,
            "spring_api": spring_status,
        },
        "buffers": {
            "recent_load_events": len(monitor.recent_load_events()),
            "recent_match_results": len(monitor.recent_match_results()),
        },
        "last_error": monitor.last_error,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }