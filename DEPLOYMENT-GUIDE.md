# LoadSetu - Production Deployment Guide

## Overview
LoadSetu is a microservices-based logistics platform with AI-powered truck-load matching capabilities.

## Architecture

### Services
- **Backend (Spring Boot)**: Core API, authentication, business logic
- **ML Engine (FastAPI)**: AI/ML matching algorithms
- **Web Frontend (Next.js)**: Shipper and fleet owner interface
- **Admin Dashboard (Next.js)**: System monitoring and management
- **PostgreSQL**: Primary database with PostGIS extension
- **Redis**: Caching and session management
- **Kafka**: Event streaming and async processing
- **Nginx**: Reverse proxy and load balancer

### Ports
| Service | Port | Protocol |
|---------|------|----------|
| Web Frontend | 3000 | HTTP |
| Backend API | 8080 | HTTP |
| ML Engine | 8000 | HTTP |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| Kafka | 9092 | TCP |
| Nginx | 80, 443 | HTTP/HTTPS |

## Prerequisites

### System Requirements
- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB minimum
- **OS**: Linux (Ubuntu 20.04+), macOS, or Windows with WSL2

### Software Requirements
- Docker 24.0+
- Docker Compose 2.20+
- Git

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/abhaysahu-cse/LoadSetu.git
cd LoadSetu
```

### 2. Configure Environment
```bash
cp .env.production.example .env.production
```

Edit `.env.production` and set:
- Database credentials
- JWT secret (must be 64 bytes base64 encoded)
- API keys (Gemini, Razorpay, etc.)
- WhatsApp credentials (Twilio/Meta)

### 3. Deploy Stack
```bash
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### 4. Verify Deployment
```bash
# Check all services are healthy
docker-compose --env-file .env.production -f docker-compose.prod.yml ps

# Check logs
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

### 5. Access Services
- Web App: http://localhost:3000
- Backend API: http://localhost:8080
- ML Engine: http://localhost:8000
- Admin Dashboard: http://localhost:3001

## Database Migrations

Migrations run automatically on backend startup using Flyway.

### Manual Migration
```bash
docker exec -it loadsetu-backend sh
./mvnw flyway:migrate
```

### Check Migration Status
```bash
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT * FROM flyway_schema_history;"
```

## Kafka Topics

Topics are created automatically by `kafka-init` service:
- `booking-events` (6 partitions)
- `truck-telemetry-events` (12 partitions)
- `load-status-events` (6 partitions)
- `whatsapp-inbound-events` (3 partitions)
- `booking-events-dlq` (3 partitions)

### Verify Topics
```bash
docker exec -it loadsetu-kafka kafka-topics --list --bootstrap-server localhost:9092
```

## Monitoring

### Health Checks
```bash
# Backend
curl http://localhost:8080/actuator/health

# ML Engine
curl http://localhost:8000/health

# Web Frontend
curl http://localhost:3000/api/health
```

### View Logs
```bash
# All services
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f

# Specific service
docker-compose --env-file .env.production -f docker-compose.prod.yml logs -f backend
```

### Resource Usage
```bash
docker stats
```

## Backup & Recovery

### Database Backup
```bash
docker exec loadsetu-postgres pg_dump -U vahansync vahansync_db > backup_$(date +%Y%m%d).sql
```

### Database Restore
```bash
cat backup_20260528.sql | docker exec -i loadsetu-postgres psql -U vahansync -d vahansync_db
```

### Volume Backup
```bash
docker run --rm -v loadsetu_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data
```

## Scaling

### Horizontal Scaling
```bash
# Scale backend
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --scale backend=3

# Scale ML engine
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --scale ml-engine=2
```

### Vertical Scaling
Edit `docker-compose.prod.yml` and adjust resource limits:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

## Security

### Environment Variables
- Never commit `.env.production` to version control
- Use strong passwords (16+ characters)
- Rotate JWT secrets regularly
- Use separate credentials for each environment

### Network Security
- Enable firewall rules
- Use HTTPS in production (configure SSL in nginx)
- Restrict database access to internal network
- Enable Redis authentication in production

### SSL/TLS Configuration
1. Obtain SSL certificates (Let's Encrypt recommended)
2. Place certificates in `ssl/` directory
3. Update `nginx.conf` to enable HTTPS
4. Restart nginx: `docker-compose restart nginx`

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker logs loadsetu-backend

# Check dependencies
docker-compose --env-file .env.production -f docker-compose.prod.yml ps
```

### Database Connection Issues
```bash
# Test connection
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db

# Check credentials in .env.production
```

### Kafka Issues
```bash
# Check Kafka logs
docker logs loadsetu-kafka

# Verify Zookeeper is healthy
docker logs loadsetu-zookeeper
```

### Out of Memory
```bash
# Check memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory
```

## Maintenance

### Update Application
```bash
git pull origin main
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove stopped containers
docker container prune
```

### Database Maintenance
```bash
# Vacuum database
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "VACUUM ANALYZE;"

# Check database size
docker exec -it loadsetu-postgres psql -U vahansync -d vahansync_db -c "SELECT pg_size_pretty(pg_database_size('vahansync_db'));"
```

## Performance Tuning

### PostgreSQL
- Adjust `shared_buffers` based on available RAM
- Tune `work_mem` for complex queries
- Enable query logging for slow queries

### Redis
- Monitor memory usage
- Adjust `maxmemory` policy
- Enable persistence if needed

### Kafka
- Adjust partition count based on throughput
- Configure retention policies
- Monitor consumer lag

## Support

For issues or questions:
- Email: support@loadsetu.in
- GitHub Issues: https://github.com/abhaysahu-cse/LoadSetu/issues

## Version History

- **v1.0.0** (May 2026): Initial production release
  - Core matching engine
  - Multi-role authentication
  - Real-time tracking
  - Payment integration
  - WhatsApp notifications
