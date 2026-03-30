import requests
import random
import time
import uuid
import subprocess
from datetime import datetime, timezone

API = "http://127.0.0.1:8000/api/v1/telemetry"
PHONE_PREFIX = "999888"


def run_psql(sql: str):
    cmd = [
        "docker",
        "exec",
        "vahansync_postgres",
        "psql",
        "-U",
        "vahansync",
        "-d",
        "vahansync_db",
        "-At",
        "-c",
        sql,
    ]
    return subprocess.run(cmd, capture_output=True, text=True)


# 1. Generate exactly 50 UUIDs
TRUCK_IDS = [str(uuid.uuid4()) for _ in range(50)]

print("🚀 Seeding PostgreSQL with 50 simulation trucks...")

success_count = 0

for i, t_id in enumerate(TRUCK_IDS):
    phone = f"999888{i:04d}"

    sql = (
        "INSERT INTO trucks (id, driver_name, phone, capacity_tons, status) "
        f"VALUES ('{t_id}', 'Sim Driver {i}', '{phone}', 20.0, 'AVAILABLE') "
        "ON CONFLICT (phone) DO NOTHING;"
    )

    result = run_psql(sql)

    if "INSERT 0 1" in result.stdout:
        success_count += 1
    elif "INSERT 0 0" in result.stdout:
        success_count += 1
    else:
        print(f"⚠️ Insert failed for {t_id}: {result.stderr or result.stdout}")

print(f"✅ Successfully inserted {success_count}/50 trucks")

# 🔴 HARD STOP if DB not properly seeded
if success_count < 45:
    print("❌ CRITICAL: Too many insert failures. Stopping simulation.")
    exit(1)

id_result = run_psql(
    f"SELECT id FROM trucks WHERE phone LIKE '{PHONE_PREFIX}____' ORDER BY phone LIMIT 50;"
)
TRUCK_IDS = [line.strip() for line in id_result.stdout.splitlines() if line.strip()]

if len(TRUCK_IDS) < 50:
    print(f"❌ CRITICAL: Expected 50 simulation trucks, found {len(TRUCK_IDS)}. Stopping simulation.")
    exit(1)

print("🔥 Starting real-time telemetry simulation...")


def generate_location():
    return {
        "lat": 23.2 + random.uniform(-0.3, 0.3),
        "lng": 77.4 + random.uniform(-0.3, 0.3)
    }


while True:
    for truck_id in TRUCK_IDS:
        payload = {
            "truck_id": truck_id,
            "lat": generate_location()["lat"],
            "lng": generate_location()["lng"],
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        }

        try:
            response = requests.post(API, json=payload, timeout=2)
            print(f"🚚 {truck_id[:8]} → {response.status_code}")
        except Exception as e:
            print(f"❌ Error: {e}")

    time.sleep(2)
