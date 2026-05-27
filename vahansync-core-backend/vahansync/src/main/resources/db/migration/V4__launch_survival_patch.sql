-- ============================================================================
-- V4__launch_survival_patch.sql
-- V4.1 lockdown: proper device-token table + replay-attack shield.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users DROP COLUMN IF EXISTS fcm_token;

CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    fcm_token VARCHAR(255) NOT NULL UNIQUE,
    device_type VARCHAR(50),
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS payment_gateway_id VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_bookings_payment_gateway_id'
    ) THEN
        ALTER TABLE bookings
            ADD CONSTRAINT uk_bookings_payment_gateway_id UNIQUE (payment_gateway_id);
    END IF;
END $$;
