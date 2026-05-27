-- ============================================================================
-- V3__user_system_hardening.sql
-- VahanSync Core Engine — V3: Identity Foundation + Production Hardening
-- ============================================================================

-- ─── USERS TABLE (Module 1: Identity Foundation) ─────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name     VARCHAR(150) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL
                      CHECK (role IN ('DRIVER', 'SHIPPER', 'FLEET_OWNER')),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Phone is the primary identity key — must be globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone
    ON users(phone);

CREATE INDEX IF NOT EXISTS idx_user_role
    ON users(role);

-- ─── ALTER TRUCKS: Add truck_number + owner_id (Module 2) ─────────────────────

ALTER TABLE trucks
    ADD COLUMN IF NOT EXISTS truck_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS owner_id     UUID REFERENCES users(id);

-- Unique index on truck_number — one registration per truck
CREATE UNIQUE INDEX IF NOT EXISTS idx_truck_number
    ON trucks(truck_number) WHERE truck_number IS NOT NULL;

-- IDOR ownership index — used by existsByIdAndOwnerId()
CREATE INDEX IF NOT EXISTS idx_truck_owner
    ON trucks(owner_id) WHERE owner_id IS NOT NULL;

-- ─── ALTER LOADS: Enforce shipperId NOT NULL (Module 2 IDOR boundary) ────────

-- Back-fill existing rows before adding NOT NULL constraint
-- (Only needed if running against existing V1/V2 data; safe to run on clean DB)
UPDATE loads SET shipper_id = uuid_generate_v4() WHERE shipper_id IS NULL;

ALTER TABLE loads
    ALTER COLUMN shipper_id SET NOT NULL;

-- ─── LOAD_HASH: Ensure unique constraint exists for ON CONFLICT DO NOTHING ───
ALTER TABLE loads
    ADD COLUMN IF NOT EXISTS load_hash VARCHAR(64);

-- Drop old index if it exists without unique constraint, recreate properly
DROP INDEX IF EXISTS idx_load_hash_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_load_hash_unique
    ON loads(load_hash) WHERE load_hash IS NOT NULL;

-- ─── BOOKING: Add driverMatchFee column if missing from V2 migration ─────────
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS driver_match_fee NUMERIC(10,2);

-- ─── UPDATED_AT TRIGGER (for JPA Auditing compatibility) ────────────────────
-- JPA @LastModifiedDate handles this in the app layer.
-- This DB trigger is a belt-and-suspenders safety net for direct SQL writes.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users table
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply to trucks table
DROP TRIGGER IF EXISTS trg_trucks_updated_at ON trucks;
CREATE TRIGGER trg_trucks_updated_at
    BEFORE UPDATE ON trucks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── KAFKA TOPIC CREATION REMINDER ───────────────────────────────────────────
-- spring.kafka.admin.auto-create=false means these must exist before app starts.
-- Run once after Docker Kafka container comes up:
--
--   docker exec -it kafka kafka-topics.sh \
--     --create --bootstrap-server localhost:9092 \
--     --topic booking-events --partitions 6 --replication-factor 1
--
--   docker exec -it kafka kafka-topics.sh \
--     --create --bootstrap-server localhost:9092 \
--     --topic truck-telemetry-events --partitions 12 --replication-factor 1
--
--   docker exec -it kafka kafka-topics.sh \
--     --create --bootstrap-server localhost:9092 \
--     --topic load-status-events --partitions 6 --replication-factor 1
--
-- See scripts/kafka-create-topics.sh

-- ─── SEED: Dev admin user ─────────────────────────────────────────────────────
-- BCrypt hash of "admin123" (strength 12). CHANGE BEFORE PRODUCTION.
INSERT INTO users (id, full_name, phone, password_hash, role)
VALUES (
    uuid_generate_v4(),
    'LoadSetu Admin',
    '+910000000000',
    '$2a$12$X4h3P5yZkjFq8ZLnqVQ6/.2bVOqMvRj9hKoJe0gM0JGXqLxG2cqXy',
    'FLEET_OWNER'
) ON CONFLICT (phone) DO NOTHING;


-- ─── V4: company_name column on users ────────────────────────────────────────
-- Stores company name for SHIPPER and FLEET_OWNER accounts.
-- NULL for individual DRIVER accounts.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(200);

-- ─── V4: driver_id column on bookings ────────────────────────────────────────
-- Stores the User.id of the authenticated driver who confirmed the booking.
-- Used for IDOR check in POST /payments/create-order/{bookingId}.
-- NULL for pre-V4 bookings (backward-compatible).

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_booking_driver_id
    ON bookings(driver_id) WHERE driver_id IS NOT NULL;

-- ─── Update bookings status constraint to include all V2/V3/V4 values ─────────
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN (
        'AWAITING_PAYMENT', 'CONFIRMED', 'IN_TRANSIT',
        'COMPLETED', 'CANCELLED', 'DRIVER_NO_SHOW', 'FRAUD_ATTEMPT'
    ));
