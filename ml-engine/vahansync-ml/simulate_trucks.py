"""
VahanSync Truck Telemetry Simulator
====================================
Seeds PostgreSQL with simulation trucks, then sends continuous
GPS telemetry pings to the FastAPI ingestion endpoint.

Usage:
    python simulate_trucks.py
"""

import random
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API = "http://127.0.0.1:8000/api/v1/telemetry"
NUM_TRUCKS = 500
PHONE_PREFIX = "9998"
PING_INTERVAL_SECONDS = 2

# Multi-region clusters — spread trucks across major freight corridors
# (city_name, center_lat, center_lng, truck_count, spawn_radius_deg)
REGIONS = [
    ("Bhopal",   23.2599, 77.4126, 200, 0.25),
    ("Indore",   22.7196, 75.8577, 120, 0.20),
    ("Jabalpur", 23.1815, 79.9864,  80, 0.15),
    ("Nagpur",   21.1458, 79.0882,  60, 0.20),
    ("Ujjain",   23.1765, 75.7885,  40, 0.10),
]

# Movement deltas per tick (small, realistic increments)
MAX_DELTA = 0.002  # ~200 m per tick


# ---------------------------------------------------------------------------
# DB Helpers
# ---------------------------------------------------------------------------
def run_psql(sql: str) -> subprocess.CompletedProcess:
    cmd = [
        "docker", "exec", "-i", "vahansync_postgres",
        "psql", "-U", "vahansync", "-d", "vahansync_db", "-At",
    ]
    return subprocess.run(cmd, input=sql, capture_output=True, text=True)


# ---------------------------------------------------------------------------
# 1. Generate deterministic truck IDs + seed PostgreSQL
# ---------------------------------------------------------------------------
# Use a fixed random seed so IDs are stable across restarts
rng = random.Random(42)
TRUCK_IDS = [str(uuid.UUID(int=rng.getrandbits(128))) for _ in range(NUM_TRUCKS)]

# Assign each truck to a region
truck_region: dict[str, tuple[str, float, float, float]] = {}
idx = 0
for region_name, clat, clng, count, radius in REGIONS:
    for _ in range(count):
        if idx < NUM_TRUCKS:
            truck_region[TRUCK_IDS[idx]] = (region_name, clat, clng, radius)
            idx += 1
# Any remaining trucks go to Bhopal
while idx < NUM_TRUCKS:
    truck_region[TRUCK_IDS[idx]] = ("Bhopal", 23.2599, 77.4126, 0.25)
    idx += 1

print(f"🚀 Seeding PostgreSQL with {NUM_TRUCKS} simulation trucks...")

# Build a single multi-row INSERT for speed
values_parts = []
for i, t_id in enumerate(TRUCK_IDS):
    phone = f"{PHONE_PREFIX}{i:06d}"
    name = f"Sim Driver {i}"
    values_parts.append(
        f"('{t_id}', '{name}', '{phone}', 30.0, 'AVAILABLE')"
    )

# Batch insert — ON CONFLICT DO NOTHING keeps existing rows untouched
batch_sql = (
    "INSERT INTO trucks (id, driver_name, phone, capacity_tons, status) VALUES "
    + ", ".join(values_parts)
    + " ON CONFLICT (id) DO NOTHING;"
)
result = run_psql(batch_sql)
if result.returncode != 0:
    print(f"⚠️ Batch insert error: {result.stderr.strip()}")
    # Fall back to individual inserts on phone conflict
    for i, t_id in enumerate(TRUCK_IDS):
        phone = f"{PHONE_PREFIX}{i:06d}"
        sql = (
            f"INSERT INTO trucks (id, driver_name, phone, capacity_tons, status) "
            f"VALUES ('{t_id}', 'Sim Driver {i}', '{phone}', 30.0, 'AVAILABLE') "
            f"ON CONFLICT (phone) DO UPDATE SET id = EXCLUDED.id, status = 'AVAILABLE';"
        )
        run_psql(sql)

# Verify
count_result = run_psql(
    f"SELECT count(*) FROM trucks WHERE phone LIKE '{PHONE_PREFIX}%' AND status = 'AVAILABLE';"
)
db_count = int(count_result.stdout.strip() or "0")
print(f"✅ {db_count}/{NUM_TRUCKS} simulation trucks in DB")

if db_count < NUM_TRUCKS * 0.9:
    print("❌ CRITICAL: Too many insert failures. Stopping simulation.")
    sys.exit(1)

# Re-read actual IDs from DB to guarantee sync
id_result = run_psql(
    f"SELECT id FROM trucks WHERE phone LIKE '{PHONE_PREFIX}%' ORDER BY phone LIMIT {NUM_TRUCKS};"
)
TRUCK_IDS = [line.strip() for line in id_result.stdout.splitlines() if line.strip()]
print(f"🔗 Loaded {len(TRUCK_IDS)} truck IDs from DB")


# ---------------------------------------------------------------------------
# 2. Initialize truck positions (spread around Bhopal)
# ---------------------------------------------------------------------------
truck_positions: dict[str, dict[str, float]] = {}
for t_id in TRUCK_IDS:
    _, clat, clng, radius = truck_region[t_id]
    truck_positions[t_id] = {
        "lat": clat + random.uniform(-radius, radius),
        "lng": clng + random.uniform(-radius, radius),
    }


# ---------------------------------------------------------------------------
# 3. Simulation loop
# ---------------------------------------------------------------------------
# IMPORTANT:
# Always start simulator BEFORE sending load events.
# Wait ~5–10 seconds for Redis to populate.
# Otherwise matching may return empty results.
# ---------------------------------------------------------------------------

print(f"🔥 Starting telemetry simulation — {len(TRUCK_IDS)} trucks @ {PING_INTERVAL_SECONDS}s interval")
for rn, _, _, rc, _ in REGIONS:
    print(f"   📍 {rn}: {rc} trucks")

# Reuse TCP connections — dramatically reduces connection errors at scale
session = requests.Session()
session.headers.update({"Content-Type": "application/json"})

cycle = 0
while True:
    cycle += 1
    sent = 0
    errors = 0

    for truck_id in TRUCK_IDS:
        pos = truck_positions[truck_id]
        region_name, clat, clng, radius = truck_region[truck_id]

        # Realistic incremental movement
        pos["lat"] += random.uniform(-MAX_DELTA, MAX_DELTA)
        pos["lng"] += random.uniform(-MAX_DELTA, MAX_DELTA)

        # Keep within region bounds
        pos["lat"] = max(clat - 0.5, min(clat + 0.5, pos["lat"]))
        pos["lng"] = max(clng - 0.5, min(clng + 0.5, pos["lng"]))

        # Speed-based status: moving trucks are in_transit/empty_return, idle are available
        speed = round(random.uniform(0, 80), 1)
        if speed > 5.0:
            status = random.choice(["in_transit"] * 7 + ["empty_return"] * 3)
        else:
            status = "available"

        payload = {
            "truck_id": truck_id,
            "lat": round(pos["lat"], 6),
            "lng": round(pos["lng"], 6),
            "speed_kmh": speed,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

        # IoT-style retry: retry on timeout, connection error, 5xx; skip on 4xx
        MAX_RETRIES = 3
        for attempt in range(MAX_RETRIES):
            try:
                resp = session.post(API, json=payload, timeout=2)
                if resp.status_code == 200:
                    sent += 1
                    break
                elif resp.status_code >= 500:
                    if attempt == MAX_RETRIES - 1:
                        errors += 1
                        print(f"⚠️ HTTP {resp.status_code} after {MAX_RETRIES} retries: {truck_id[:8]}")
                    else:
                        time.sleep(0.1)
                else:
                    # 4xx — client error, no retry
                    errors += 1
                    if errors <= 3 or errors % 50 == 0:
                        print(f"⚠️ HTTP {resp.status_code} for {truck_id[:8]}: {resp.text[:120]}")
                    break
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
                if attempt == MAX_RETRIES - 1:
                    errors += 1
                    if errors <= 3:
                        print(f"❌ Failed after {MAX_RETRIES} retries: {exc}")
                else:
                    time.sleep(0.1)
            except Exception as exc:
                errors += 1
                if errors <= 3:
                    print(f"⚠️ Unexpected: {exc}")
                break

        # Stagger requests to avoid burst load on Kafka/Redis
        time.sleep(random.uniform(0.01, 0.05))

    print(f"📡 Cycle {cycle}: sent={sent} errors={errors} trucks={len(TRUCK_IDS)}")
    time.sleep(PING_INTERVAL_SECONDS)
