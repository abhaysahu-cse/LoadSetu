from __future__ import annotations

import argparse
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import asyncpg
import httpx
import redis.asyncio as aioredis
from aiokafka import AIOKafkaConsumer


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Stage5Validator:
    def __init__(
        self,
        api_base: str,
        brokers: str,
        redis_url: str,
        database_url: str,
        telemetry_topic: str,
        load_topic: str,
        match_topic: str,
    ) -> None:
        self.api_base = api_base.rstrip("/")
        self.brokers = brokers
        self.redis_url = redis_url
        self.database_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
        self.telemetry_topic = telemetry_topic
        self.load_topic = load_topic
        self.match_topic = match_topic

    async def run(self) -> None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await self.check_health(client)
            await self.check_telemetry_flow(client)
            await self.check_matching_flow(client)
            await self.check_consistency(client)
        self.print_failure_checklist()

    async def check_health(self, client: httpx.AsyncClient) -> None:
        response = await client.get(f"{self.api_base}/health")
        response.raise_for_status()
        print("[PASS] Python health endpoint is reachable")

    async def check_telemetry_flow(self, client: httpx.AsyncClient) -> None:
        truck_id = f"stage5-telemetry-{uuid.uuid4().hex[:10]}"
        payload = {
            "truck_id": truck_id,
            "lat": 23.2599,
            "lng": 77.4126,
            "speed_kmh": 0,
            "status": "empty_return",
            "timestamp": utc_now(),
        }

        response = await client.post(f"{self.api_base}/api/v1/telemetry", json=payload)
        response.raise_for_status()

        redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
        try:
            h3_key = f"truck:h3:{truck_id}"
            location_key = f"truck:location:{truck_id}"
            deadline = asyncio.get_running_loop().time() + 12
            while asyncio.get_running_loop().time() < deadline:
                if await redis_client.exists(h3_key) and await redis_client.exists(location_key):
                    print("[PASS] Telemetry flow populated Redis keys")
                    return
                await asyncio.sleep(0.5)
        finally:
            await redis_client.aclose()

        raise RuntimeError("Telemetry flow did not populate Redis within timeout")

    async def check_matching_flow(self, client: httpx.AsyncClient) -> None:
        truck_id = (await self._load_fleet_truck_ids(required=1))[0]
        await client.post(
            f"{self.api_base}/api/v1/telemetry",
            json={
                "truck_id": truck_id,
                "lat": 23.2599,
                "lng": 77.4126,
                "speed_kmh": 0,
                "status": "empty_return",
                "timestamp": utc_now(),
            },
        )
        await asyncio.sleep(2)

        consumer = AIOKafkaConsumer(
            self.match_topic,
            bootstrap_servers=self.brokers,
            group_id=f"stage5-validator-match-{uuid.uuid4().hex[:8]}",
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )
        try:
            await consumer.start()
            response = await client.post(
                f"{self.api_base}/api/v1/admin/force-match",
                json={
                    "origin": "Bhopal",
                    "destination": "Nagpur",
                    "weight_tons": 10,
                },
            )
            response.raise_for_status()
            load_id = response.json()["load_id"]

            match_payload = await self._wait_for_match(consumer, {load_id}, 20)
            matches = match_payload[load_id].get("matches", [])
            if not matches:
                raise RuntimeError("Matching flow returned an empty match list")
            print("[PASS] Matching flow produced non-empty load-matches payload")
        finally:
            await consumer.stop()

    async def check_consistency(self, client: httpx.AsyncClient) -> None:
        truck_ids = await self._load_fleet_truck_ids(required=10)
        consumer = AIOKafkaConsumer(
            self.match_topic,
            bootstrap_servers=self.brokers,
            group_id=f"stage5-validator-consistency-{uuid.uuid4().hex[:8]}",
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )

        load_ids: set[str] = set()
        try:
            await consumer.start()
            telemetry_tasks = []
            for index, truck_id in enumerate(truck_ids[:10]):
                telemetry_tasks.append(
                    client.post(
                        f"{self.api_base}/api/v1/telemetry",
                        json={
                            "truck_id": truck_id,
                            "lat": 23.2599 + index * 0.001,
                            "lng": 77.4126 + index * 0.001,
                            "speed_kmh": 0,
                            "status": "empty_return",
                            "timestamp": utc_now(),
                        },
                    )
                )
            await asyncio.gather(*telemetry_tasks)
            await asyncio.sleep(2)

            for index in range(10):
                response = await client.post(
                    f"{self.api_base}/api/v1/admin/force-match",
                    json={
                        "origin": "Bhopal",
                        "destination": "Nagpur",
                        "weight_tons": 12,
                    },
                )
                response.raise_for_status()
                load_ids.add(response.json()["load_id"])

            matches = await self._wait_for_match(consumer, load_ids, 25)
            success_count = sum(
                1 for payload in matches.values() if isinstance(payload.get("matches"), list) and payload["matches"]
            )
            success_rate = success_count / len(load_ids)
            if success_rate < 0.7:
                raise RuntimeError(f"Consistency test below threshold: {success_rate:.0%}")
            print(f"[PASS] Consistency test success rate: {success_rate:.0%}")
        finally:
            await consumer.stop()

    async def _wait_for_match(
        self,
        consumer: AIOKafkaConsumer,
        load_ids: set[str],
        timeout_seconds: int,
    ) -> dict[str, dict[str, Any]]:
        deadline = asyncio.get_running_loop().time() + timeout_seconds
        seen: dict[str, dict[str, Any]] = {}
        while asyncio.get_running_loop().time() < deadline and len(seen) < len(load_ids):
            batch = await consumer.getmany(timeout_ms=1500)
            for records in batch.values():
                for record in records:
                    payload = json.loads(record.value.decode("utf-8"))
                    if isinstance(payload, str):
                        payload = json.loads(payload)
                    load_id = payload.get("loadId")
                    if load_id in load_ids:
                        seen[load_id] = payload
            await asyncio.sleep(0.1)
        if len(seen) < len(load_ids):
            missing = sorted(load_ids - seen.keys())
            raise RuntimeError(f"Timed out waiting for load-matches payloads: {missing}")
        return seen

    @staticmethod
    def print_failure_checklist() -> None:
        print("[MANUAL] Failure handling checklist")
        print("  1. Stop the Python FastAPI process.")
        print("  2. Publish a test load to load-events and confirm load-matches returns empty matches.")
        print("  3. Restart the Python FastAPI process.")
        print("  4. Publish the same load again and confirm non-empty matches return.")

    async def _load_fleet_truck_ids(self, required: int) -> list[str]:
        connection = await asyncpg.connect(self.database_url)
        try:
            rows = await connection.fetch(
                """
                select id::text as truck_id
                from trucks
                where status in ('AVAILABLE', 'EMPTY_RETURN')
                order by updated_at desc nulls last, created_at desc nulls last
                limit $1
                """,
                required,
            )
        finally:
            await connection.close()

        truck_ids = [row["truck_id"] for row in rows]
        if len(truck_ids) < required:
            raise RuntimeError(f"Need at least {required} eligible trucks in PostgreSQL, found {len(truck_ids)}")
        return truck_ids


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Stage 5 end-to-end validation")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--brokers", default="localhost:9092")
    parser.add_argument("--redis-url", default="redis://localhost:6379/0")
    parser.add_argument("--telemetry-topic", default="truck-telemetry-events")
    parser.add_argument("--load-topic", default="load-events")
    parser.add_argument("--match-topic", default="load-matches")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    validator = Stage5Validator(
        api_base=args.api_base,
        brokers=args.brokers,
        redis_url=args.redis_url,
        database_url=os.environ.get(
            "DATABASE_URL",
            "postgresql+asyncpg://vahansync:vahansync_secret@localhost:5433/vahansync_db",
        ),
        telemetry_topic=args.telemetry_topic,
        load_topic=args.load_topic,
        match_topic=args.match_topic,
    )
    await validator.run()


if __name__ == "__main__":
    asyncio.run(main())