# Deploy to EC2 - Quick Guide

**Latest Commit:** e1a09fc  
**Status:** Ready for deployment ✅

---

## 🚀 EC2 Deployment Commands

Copy and paste these commands on your EC2 instance:

```bash
# 1. Navigate to project directory
cd ~/LoadSetu

# 2. Pull latest code
git pull origin main

# 3. Stop and remove existing containers (clean slate)
docker-compose --env-file .env.production -f docker-compose.prod.yml down -v

# 4. Rebuild and start all services
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build

# 5. Wait for services to be healthy (about 2 minutes)
echo "Waiting for services to start..."
sleep 120

# 6. Create Kafka topics
docker exec loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 --partitions 6 --replication-factor 1 \
  --topic load-events

docker exec loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 --partitions 6 --replication-factor 1 \
  --topic load-matches

# 7. Verify all services are healthy
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# 8. Test health endpoints
echo "Testing Backend..."
curl http://localhost:8080/actuator/health

echo "Testing ML Engine..."
curl http://localhost:8000/health

echo "Testing Web App..."
curl http://localhost:3000/api/health

# 9. Check database
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "\dt"
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT COUNT(*) FROM loads;"

# 10. Check Flyway migrations
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT * FROM flyway_schema_history ORDER BY installed_rank;"
```

---

## ✅ Expected Results

### Container Status
All containers should show "healthy":
```
NAME                 STATUS
loadsetu-backend     Up X minutes (healthy)
loadsetu-ml-engine   Up X minutes (healthy)
loadsetu-web         Up X minutes (healthy)
loadsetu-postgres    Up X minutes (healthy)
loadsetu-redis       Up X minutes (healthy)
loadsetu-kafka       Up X minutes (healthy)
loadsetu-zookeeper   Up X minutes (healthy)
loadsetu-nginx       Up X minutes (healthy)
```

### Health Endpoints
```json
// Backend
{"status":"UP"}

// ML Engine
{"status":"ok","service":"vahansync-ai-microservice","version":"1.0.0"}

// Web App
{"status":"healthy","timestamp":"...","service":"loadsetu-web"}
```

### Database
- 8 tables created
- 100 demo loads
- 5 Flyway migrations applied

---

## 🧪 Test Registration on EC2

```bash
# Test registration
curl -X POST http://localhost:3000/api/auth/register-shipper \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "password": "Test@1234",
    "companyName": "Test Company EC2"
  }'

# Expected: JWT token and user details
```

---

## 🔍 Troubleshooting

### If backend fails to start:
```bash
docker logs loadsetu-backend --tail 100
```

### If database is empty:
```bash
# Check if migrations ran
docker logs loadsetu-backend | grep Flyway

# Manually check migration files
docker exec loadsetu-backend ls -la /app/BOOT-INF/classes/db/migration/
```

### If Kafka topics missing:
```bash
# List existing topics
docker exec loadsetu-kafka kafka-topics --list --bootstrap-server localhost:9092

# Recreate if needed (commands in step 6 above)
```

---

## 📊 Access URLs (After Deployment)

Replace `YOUR_EC2_IP` with your actual EC2 public IP:

- **Web App:** `http://YOUR_EC2_IP:3000`
- **Backend API:** `http://YOUR_EC2_IP:8080`
- **ML Engine:** `http://YOUR_EC2_IP:8000`
- **Backend Health:** `http://YOUR_EC2_IP:8080/actuator/health`

---

## 🎯 Success Criteria

✅ All 8 containers running and healthy  
✅ Backend health endpoint returns `{"status":"UP"}`  
✅ ML Engine health endpoint returns `{"status":"ok"}`  
✅ Web app health endpoint returns `{"status":"healthy"}`  
✅ Database has 8 tables  
✅ 100 demo loads in database  
✅ 5 Flyway migrations applied  
✅ 2 Kafka topics created  
✅ Registration API works  

---

## 🚨 If Something Goes Wrong

1. **Check logs:** `docker logs loadsetu-backend --tail 100`
2. **Restart specific service:** `docker-compose --env-file .env.production -f docker-compose.prod.yml restart backend`
3. **Full restart:** Run steps 3-10 again
4. **Check GitHub:** Ensure you pulled latest commit `e1a09fc`

---

**Ready to deploy!** 🚀
