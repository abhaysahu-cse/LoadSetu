-- ============================================================================
-- V2__v2_fintech_safety_ml_pipeline.sql
-- VahanSync Core Engine — V2: Fintech Safety + ML Pipeline + Outbox Pattern
-- ============================================================================

-- ─── ALTER trucks: add shadow-ban counter ────────────────────────────────────
ALTER TABLE trucks
    ADD COLUMN IF NOT EXISTS no_show_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_truck_no_show
    ON trucks(no_show_count) WHERE no_show_count > 0;

-- ─── ALTER bookings: add ML fields + new statuses + driver_match_fee ─────────
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS deadhead_km          FLOAT,
    ADD COLUMN IF NOT EXISTS confidence_score     FLOAT
        CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    ADD COLUMN IF NOT EXISTS original_payout_inr  NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS driver_match_fee     NUMERIC(10,2);

-- Status column now supports FRAUD_ATTEMPT and DRIVER_NO_SHOW
ALTER TABLE bookings
    DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
    ADD CONSTRAINT bookings_status_check
    CHECK (status IN (
        'AWAITING_PAYMENT', 'CONFIRMED', 'IN_TRANSIT',
        'COMPLETED', 'CANCELLED', 'DRIVER_NO_SHOW', 'FRAUD_ATTEMPT'
    ));

-- ─── ALTER loads: add load_hash for deduplication ────────────────────────────
ALTER TABLE loads
    ADD COLUMN IF NOT EXISTS load_hash VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_load_hash_unique
    ON loads(load_hash) WHERE load_hash IS NOT NULL;

-- ─── PAYMENT AUDIT LOGS ──────────────────────────────────────────────────────
-- Every incoming payment webhook is written here BEFORE any booking logic.
-- Uses REQUIRES_NEW transaction — commits independently.
-- NEVER delete rows from this table.

CREATE TABLE IF NOT EXISTS payment_audit_logs (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id          UUID,        -- FK not enforced — webhook may have forged ID
    webhook_amount      NUMERIC(12,2),
    expected_amount     NUMERIC(12,2),
    gateway_reference   VARCHAR(200),
    gateway_name        VARCHAR(50),
    gateway_status      VARCHAR(50),
    raw_payload         TEXT NOT NULL,
    is_fraud_suspected  BOOLEAN NOT NULL DEFAULT FALSE,
    sender_ip           VARCHAR(50),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pal_booking_id  ON payment_audit_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_pal_gateway_ref ON payment_audit_logs(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_pal_fraud       ON payment_audit_logs(is_fraud_suspected)
    WHERE is_fraud_suspected = TRUE;
CREATE INDEX IF NOT EXISTS idx_pal_created     ON payment_audit_logs(created_at DESC);

-- ─── PRICING IMPRESSION LOGS (ML XGBoost Training Data) ──────────────────────
-- Every WhatsApp teaser → driver response is logged here.
-- driver_whatsapp is MASKED — last 4 digits only (DPDP Act compliance).

CREATE TABLE IF NOT EXISTS pricing_impression_logs (
    id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    load_id                  UUID        NOT NULL,
    driver_whatsapp_masked   VARCHAR(20),
    offered_payout_inr       FLOAT,
    deadhead_km              FLOAT,
    local_truck_supply       INTEGER,
    response_time_ms         BIGINT,
    driver_response          VARCHAR(20)
        CHECK (driver_response IN ('ACCEPTED', 'REJECTED', 'IGNORED')),
    timestamp                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pil_load_id   ON pricing_impression_logs(load_id);
CREATE INDEX IF NOT EXISTS idx_pil_response  ON pricing_impression_logs(driver_response);
CREATE INDEX IF NOT EXISTS idx_pil_timestamp ON pricing_impression_logs(timestamp DESC);

-- ─── OUTBOX EVENTS (Transactional Outbox Pattern) ────────────────────────────
-- Guaranteed Kafka delivery via scheduled relay.
-- retryCount + nextAttemptAt enable exponential backoff.
-- status = DLQ after maxRetries exceeded — requires manual inspection.

CREATE TABLE IF NOT EXISTS outbox_events (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type   VARCHAR(50) NOT NULL,
    aggregate_id     UUID        NOT NULL,
    topic            VARCHAR(100) NOT NULL,
    message_key      VARCHAR(200),
    payload          TEXT        NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED', 'DLQ')),
    retry_count      INTEGER     NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMP,
    last_error       TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_status
    ON outbox_events(status) WHERE status IN ('PENDING', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_outbox_next_attempt
    ON outbox_events(next_attempt_at) WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
    ON outbox_events(aggregate_id);

-- ─── Kafka topic creation scripts (run via admin before app start) ────────────
-- Reminder: spring.kafka.admin.auto-create=false means these must be
-- pre-created on the Kafka broker. Use the script below or the
-- scripts/kafka-create-topics.sh file.
--
-- kafka-topics.sh --create --bootstrap-server localhost:9092 \
--   --topic booking-events --partitions 6 --replication-factor 3
-- kafka-topics.sh --create --bootstrap-server localhost:9092 \
--   --topic truck-telemetry-events --partitions 12 --replication-factor 3
-- kafka-topics.sh --create --bootstrap-server localhost:9092 \
--   --topic load-status-events --partitions 6 --replication-factor 3
-- kafka-topics.sh --create --bootstrap-server localhost:9092 \
--   --topic booking-events-dlq --partitions 3 --replication-factor 3
