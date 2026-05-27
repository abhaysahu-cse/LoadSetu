-- ============================================================================
-- V1__init_vahansync_schema.sql
-- VahanSync Core Engine — Initial Database Schema
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS postgis;
--   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
-- Run via Flyway (classpath:db/migration/V1__init_vahansync_schema.sql)
-- ============================================================================

-- Enable PostGIS if not already enabled (superuser required)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TRUCKS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trucks (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_name         VARCHAR(150) NOT NULL,
    phone               VARCHAR(20)  NOT NULL UNIQUE,
    capacity_tons       FLOAT        NOT NULL CHECK (capacity_tons > 0),
    -- PostGIS Point geometry — SRID 4326 (WGS84 — same as GPS lat/lng)
    current_location    geometry(Point, 4326),
    status              VARCHAR(30)  NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE','EN_ROUTE','EMPTY_RETURN','OFFLINE')),
    registration_number VARCHAR(20),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- GIST spatial index for real-time location queries
CREATE INDEX IF NOT EXISTS idx_truck_location_geom
    ON trucks USING GIST(current_location);

CREATE INDEX IF NOT EXISTS idx_truck_status
    ON trucks(status);

-- ─── LOADS ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS loads (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_name         VARCHAR(200) NOT NULL,
    -- origin_geom: primary field for ST_DWithin 50km radius search
    origin_geom         geometry(Point, 4326) NOT NULL,
    destination_name    VARCHAR(200) NOT NULL,
    destination_geom    geometry(Point, 4326) NOT NULL,
    required_capacity   FLOAT       NOT NULL CHECK (required_capacity > 0),
    payout_inr          NUMERIC(12,2) NOT NULL CHECK (payout_inr > 0),
    pickup_time         TIMESTAMPTZ NOT NULL,
    posted_at           TIMESTAMPTZ,
    status              VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN (
                                'AVAILABLE','MATCHED','BOOKED',
                                'IN_TRANSIT','DELIVERED','CANCELLED')),
    shipper_id          UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: GIST index on origin_geom — ST_DWithin query will table-scan without this
CREATE INDEX IF NOT EXISTS idx_load_origin_geom
    ON loads USING GIST(origin_geom);

CREATE INDEX IF NOT EXISTS idx_load_destination_geom
    ON loads USING GIST(destination_geom);

CREATE INDEX IF NOT EXISTS idx_load_status
    ON loads(status);

CREATE INDEX IF NOT EXISTS idx_load_pickup_time
    ON loads(pickup_time);

-- Composite index for the matching query (status + capacity filter)
CREATE INDEX IF NOT EXISTS idx_load_status_capacity
    ON loads(status, required_capacity)
    WHERE status = 'AVAILABLE';

-- ─── BOOKINGS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bookings (
    id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    truck_id            UUID        NOT NULL REFERENCES trucks(id),
    load_id             UUID        NOT NULL REFERENCES loads(id),
    agreed_payout       NUMERIC(12,2) NOT NULL,
    deadhead_km         FLOAT,
    confidence_score    FLOAT,
    status              VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED'
                            CHECK (status IN ('CONFIRMED','IN_TRANSIT','COMPLETED','CANCELLED')),
    source_message_id   VARCHAR(100) UNIQUE,  -- WhatsApp message ID for idempotency
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_booking_truck_id  ON bookings(truck_id);
CREATE INDEX IF NOT EXISTS idx_booking_load_id   ON bookings(load_id);
CREATE INDEX IF NOT EXISTS idx_booking_status    ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_booking_created   ON bookings(created_at DESC);

-- ─── SEED: Sample loads around Surat for dev/testing ────────────────────────
-- Remove before deploying to production

INSERT INTO loads (origin_name, origin_geom, destination_name, destination_geom,
                   required_capacity, payout_inr, pickup_time, status)
VALUES
    -- Load 1: Surat → Bhopal  (within 50km of Surat center)
    ('Surat Port',
     ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326),
     'Bhopal',
     ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326),
     10.0, 18000.00, NOW() + INTERVAL '1 day', 'AVAILABLE'),

    -- Load 2: Surat → Mumbai
    ('Surat Industrial Zone',
     ST_SetSRID(ST_MakePoint(72.8977, 21.2010), 4326),
     'Mumbai',
     ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326),
     8.5, 12500.00, NOW() + INTERVAL '6 hours', 'AVAILABLE'),

    -- Load 3: Near Surat → Pune
    ('Sachin GIDC, Surat',
     ST_SetSRID(ST_MakePoint(72.9600, 21.1000), 4326),
     'Pune',
     ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326),
     15.0, 22000.00, NOW() + INTERVAL '2 days', 'AVAILABLE')

ON CONFLICT DO NOTHING;
