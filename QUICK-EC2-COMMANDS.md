# Quick EC2 Deployment Commands

## 🚀 Deploy in 3 Steps

```bash
# 1. Pull latest code
cd ~/LoadSetu && git pull origin main

# 2. Rebuild and start
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d --build

# 3. Watch logs
docker logs -f loadsetu-backend
```

## 📊 Quick Status Check

```bash
# All services status
docker-compose -f docker-compose.prod.yml ps

# Health checks
curl http://localhost:8080/actuator/health  # Backend
curl http://localhost:8000/health           # ML Engine
curl http://localhost:3000/api/health       # Web App
curl http://localhost/health                # Nginx
```

## 🔍 Quick Verification

```bash
# Check database tables
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "\dt"

# Count demo loads
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT COUNT(*) FROM loads;"

# Check Flyway migrations
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT * FROM flyway_schema_history;"
```

## 📝 View Logs

```bash
docker logs -f loadsetu-backend    # Backend
docker logs -f loadsetu-ml-engine  # ML Engine
docker logs -f loadsetu-web        # Web App
docker logs -f loadsetu-postgres   # Database
docker logs -f loadsetu-kafka      # Kafka
```

## 🛑 Stop Everything

```bash
docker-compose -f docker-compose.prod.yml down
```

## 🗑️ Clean Restart (removes all data)

```bash
docker-compose -f docker-compose.prod.yml down -v
docker system prune -f
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔧 Troubleshooting

```bash
# Enter backend container
docker exec -it loadsetu-backend bash

# Enter database
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db

# Check migration files in container
docker exec -it loadsetu-backend ls -la /app/BOOT-INF/classes/db/migration/

# Restart single service
docker-compose -f docker-compose.prod.yml restart backend
```

## 📦 Kafka Topics

```bash
# List topics
docker exec -it loadsetu-kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topics
docker exec -it loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 --partitions 6 --replication-factor 1 \
  --topic load-events

docker exec -it loadsetu-kafka kafka-topics --create --if-not-exists \
  --bootstrap-server localhost:9092 --partitions 6 --replication-factor 1 \
  --topic load-matches
```

## 🌐 Access URLs (after deployment)

- **Web App:** http://your-ec2-ip/
- **Backend API:** http://your-ec2-ip/api/spring/
- **ML Engine:** http://your-ec2-ip/api/ai/
- **Backend Health:** http://your-ec2-ip/api/spring/actuator/health
- **ML Health:** http://your-ec2-ip/api/ai/health

---
**Latest Commit:** ae2a987 (includes V1-V4 migrations)
