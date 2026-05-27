# EC2 Deployment Fix - Missing Database Migrations

## Problem Identified
The backend container was failing because only V5 migration (seed demo loads) existed in the repository, but V1-V4 migrations (that create the database schema) were missing.

## Solution Applied
✅ Added missing Flyway migrations V1-V4 to GitHub (commit: ae2a987)
- V1__init_vahansync_schema.sql (creates base tables)
- V2__v2_fintech_safety_ml_pipeline.sql (adds ML features)
- V3__user_system_hardening.sql (user system improvements)
- V4__launch_survival_patch.sql (production fixes)

## EC2 Deployment Steps

### 1. Pull Latest Code
```bash
cd ~/LoadSetu
git fetch origin
git reset --hard origin/main
```

### 2. Verify Migration Files
```bash
cd ~/LoadSetu/vahansync-core-backend/vahansync/src/main/resources/db/migration
ls -la
```
**Expected output:** V1, V2, V3, V4, V5 SQL files

### 3. Stop and Clean Existing Containers
```bash
cd ~/LoadSetu
docker-compose -f docker-compose.prod.yml down -v
```
**Note:** The `-v` flag removes volumes to ensure a clean database

### 4. Rebuild and Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

### 5. Monitor Backend Logs
```bash
docker logs -f loadsetu-backend
```
**Look for:**
- ✅ "Flyway: Successfully validated 5 migrations"
- ✅ "Flyway: Successfully applied 5 migrations"
- ✅ "Started VahansyncCoreApplication"

### 6. Verify Database Schema
```bash
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "\dt"
```
**Expected tables:**
- users
- trucks
- loads
- bookings
- matches
- payments
- outbox_events
- flyway_schema_history

### 7. Check Demo Data
```bash
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT COUNT(*) FROM loads;"
```
**Expected:** 100 demo loads from MP cities

### 8. Verify All Services
```bash
docker-compose -f docker-compose.prod.yml ps
```
**All services should show "healthy"**

### 9. Test Health Endpoints
```bash
# Backend
curl http://localhost:8080/actuator/health

# ML Engine
curl http://localhost:8000/health

# Web App
curl http://localhost:3000/api/health

# Nginx
curl http://localhost/health
```

### 10. Create Kafka Topics (if needed)
```bash
docker exec -it loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --partitions 6 --replication-factor 1 \
  --topic load-events

docker exec -it loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 \
  --partitions 6 --replication-factor 1 \
  --topic load-matches
```

## Troubleshooting

### If Backend Still Fails
```bash
# Check backend logs
docker logs loadsetu-backend --tail 100

# Check database connection
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT version();"
```

### If Database User Error
The correct PostgreSQL user is `vahansync`, not `postgres`. Use:
```bash
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db
```

### If Flyway Validation Fails
```bash
# Check migration files in container
docker exec -it loadsetu-backend ls -la /app/BOOT-INF/classes/db/migration/

# Check Flyway history
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db \
  -c "SELECT * FROM flyway_schema_history ORDER BY installed_rank;"
```

## Success Criteria
✅ All 5 Flyway migrations applied successfully
✅ Database schema created with all tables
✅ 100 demo loads seeded from MP cities
✅ Backend, ML Engine, Web App all healthy
✅ Nginx reverse proxy working
✅ All health endpoints responding

## Next Steps After Successful Deployment
1. Test driver registration API
2. Verify load matching triggers automatically
3. Test booking flow end-to-end
4. Configure domain and SSL certificates
5. Set up monitoring and alerts

---
**Commit:** ae2a987
**Date:** May 27, 2026
**Status:** Ready for EC2 deployment
