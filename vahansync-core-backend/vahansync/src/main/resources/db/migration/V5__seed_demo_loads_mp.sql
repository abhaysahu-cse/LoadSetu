-- ============================================================================
-- V5__seed_demo_loads_mp.sql
-- Seed 100 demo loads from Madhya Pradesh cities
-- 
-- Cities covered: Bhopal, Indore, Jabalpur, Gwalior, Ujjain
-- Routes: Intra-MP and to major destinations (Delhi, Mumbai, Pune, Nagpur)
-- ============================================================================

-- ─── Demo Shipper Account ───────────────────────────────────────────────────
-- Password: Demo@123 (BCrypt hash)
INSERT INTO users (id, full_name, phone, password_hash, role, company_name, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'LoadSetu Demo Shipper',
    '+919999999999',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhkO',
    'SHIPPER',
    'LoadSetu Demo Corp',
    NOW()
) ON CONFLICT (phone) DO NOTHING;

-- ─── Bhopal Origin Loads (20 loads) ─────────────────────────────────────────
-- Bhopal coordinates: 23.2599, 77.4126

-- Bhopal → Indore (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 5.0, 8500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 10.0, 12000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 15.0, 15000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 7.5, 10000.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 20.0, 18000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- Bhopal → Delhi (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 10.0, 28000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 15.0, 35000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 20.0, 42000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 12.0, 30000.00, NOW() + INTERVAL '15 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 8.0, 25000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Bhopal → Mumbai (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 10.0, 32000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 15.0, 38000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 20.0, 45000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 12.0, 35000.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 8.0, 28000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE');

-- Bhopal → Jabalpur (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 5.0, 7500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 10.0, 11000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 15.0, 14000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 7.5, 9500.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 20.0, 17000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- ─── Indore Origin Loads (20 loads) ─────────────────────────────────────────
-- Indore coordinates: 22.7196, 75.8577

-- Indore → Bhopal (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 5.0, 8500.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 10.0, 12000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 15.0, 15000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 7.5, 10000.00, NOW() + INTERVAL '20 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 20.0, 18000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- Indore → Mumbai (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 10.0, 26000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 15.0, 32000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 20.0, 38000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 12.0, 29000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Mumbai, MH', ST_SetSRID(ST_MakePoint(72.8777, 19.0760), 4326), 8.0, 24000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- Indore → Pune (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Pune, MH', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 10.0, 22000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Pune, MH', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 15.0, 28000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Pune, MH', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 20.0, 34000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Pune, MH', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 12.0, 25000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Pune, MH', ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326), 8.0, 20000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- Indore → Ujjain (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 5.0, 3500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 10.0, 5500.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 15.0, 7000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 7.5, 4500.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 20.0, 8500.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- Indore → Nagpur (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 10.0, 18000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 15.0, 24000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 20.0, 30000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 12.0, 21000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 8.0, 16000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- ─── Jabalpur Origin Loads (20 loads) ───────────────────────────────────────
-- Jabalpur coordinates: 23.1815, 79.9864

-- Jabalpur → Bhopal (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 5.0, 7500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 10.0, 11000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 15.0, 14000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 7.5, 9500.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 20.0, 17000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- Jabalpur → Nagpur (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 10.0, 12000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 15.0, 16000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 20.0, 20000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 12.0, 14000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Nagpur, MH', ST_SetSRID(ST_MakePoint(79.0882, 21.1458), 4326), 8.0, 10000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Jabalpur → Kolkata (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Kolkata, WB', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 10.0, 38000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Kolkata, WB', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 15.0, 48000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Kolkata, WB', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 20.0, 58000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Kolkata, WB', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 12.0, 42000.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Kolkata, WB', ST_SetSRID(ST_MakePoint(88.3639, 22.5726), 4326), 8.0, 34000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE');

-- Jabalpur → Indore (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 10.0, 16000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 15.0, 21000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 20.0, 26000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 12.0, 18000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Jabalpur, MP', ST_SetSRID(ST_MakePoint(79.9864, 23.1815), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 8.0, 14000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- ─── Gwalior Origin Loads (20 loads) ────────────────────────────────────────
-- Gwalior coordinates: 26.2183, 78.1828

-- Gwalior → Delhi (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 10.0, 18000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 15.0, 24000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 20.0, 30000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 12.0, 21000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Delhi', ST_SetSRID(ST_MakePoint(77.1025, 28.7041), 4326), 8.0, 16000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Gwalior → Jaipur (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Jaipur, RJ', ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326), 10.0, 14000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Jaipur, RJ', ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326), 15.0, 19000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Jaipur, RJ', ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326), 20.0, 24000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Jaipur, RJ', ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326), 12.0, 16000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Jaipur, RJ', ST_SetSRID(ST_MakePoint(75.7873, 26.9124), 4326), 8.0, 12000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Gwalior → Bhopal (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 10.0, 16000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 15.0, 21000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 20.0, 26000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 12.0, 18000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 8.0, 14000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Gwalior → Agra (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Agra, UP', ST_SetSRID(ST_MakePoint(78.0081, 27.1767), 4326), 5.0, 5500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Agra, UP', ST_SetSRID(ST_MakePoint(78.0081, 27.1767), 4326), 10.0, 8500.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Agra, UP', ST_SetSRID(ST_MakePoint(78.0081, 27.1767), 4326), 15.0, 11000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Agra, UP', ST_SetSRID(ST_MakePoint(78.0081, 27.1767), 4326), 7.5, 7000.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Gwalior, MP', ST_SetSRID(ST_MakePoint(78.1828, 26.2183), 4326), 'Agra, UP', ST_SetSRID(ST_MakePoint(78.0081, 27.1767), 4326), 20.0, 13000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- ─── Ujjain Origin Loads (20 loads) ─────────────────────────────────────────
-- Ujjain coordinates: 23.1765, 75.7885

-- Ujjain → Indore (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 5.0, 3500.00, NOW() + INTERVAL '6 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 10.0, 5500.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 15.0, 7000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 7.5, 4500.00, NOW() + INTERVAL '18 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Indore, MP', ST_SetSRID(ST_MakePoint(75.8577, 22.7196), 4326), 20.0, 8500.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE');

-- Ujjain → Ahmedabad (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Ahmedabad, GJ', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 10.0, 16000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Ahmedabad, GJ', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 15.0, 21000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Ahmedabad, GJ', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 20.0, 26000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Ahmedabad, GJ', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 12.0, 18000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Ahmedabad, GJ', ST_SetSRID(ST_MakePoint(72.5714, 23.0225), 4326), 8.0, 14000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- Ujjain → Bhopal (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 10.0, 9000.00, NOW() + INTERVAL '8 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 15.0, 12000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 20.0, 15000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 12.0, 10000.00, NOW() + INTERVAL '14 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Bhopal, MP', ST_SetSRID(ST_MakePoint(77.4126, 23.2599), 4326), 8.0, 8000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE');

-- Ujjain → Surat (5 loads)
INSERT INTO loads (id, shipper_id, origin_name, origin_geom, destination_name, destination_geom, required_capacity, payout_inr, pickup_time, posted_at, status)
VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Surat, GJ', ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326), 10.0, 18000.00, NOW() + INTERVAL '10 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Surat, GJ', ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326), 15.0, 24000.00, NOW() + INTERVAL '1 day', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Surat, GJ', ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326), 20.0, 30000.00, NOW() + INTERVAL '2 days', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Surat, GJ', ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326), 12.0, 21000.00, NOW() + INTERVAL '16 hours', NOW(), 'AVAILABLE'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001'::uuid, 'Ujjain, MP', ST_SetSRID(ST_MakePoint(75.7885, 23.1765), 4326), 'Surat, GJ', ST_SetSRID(ST_MakePoint(72.8311, 21.1702), 4326), 8.0, 16000.00, NOW() + INTERVAL '12 hours', NOW(), 'AVAILABLE');

-- ─── Summary ─────────────────────────────────────────────────────────────────
-- Total: 100 demo loads
-- Bhopal: 20 loads
-- Indore: 20 loads
-- Jabalpur: 20 loads
-- Gwalior: 20 loads
-- Ujjain: 20 loads
