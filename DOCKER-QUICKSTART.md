# 🐳 Docker Deployment Quick Start

Fast track guide to deploy LoadSetu using Docker Compose.

---

## ⚡ Quick Deploy (5 Minutes)

### 1. Prerequisites Check

```bash
# Check Docker
docker --version

# Check Docker Compose
docker-compose --version

# If not installed, run:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 2. Configure Environment

```bash
# Copy template
cp .env.production.example .env.production

# Generate secrets
echo "JWT_SECRET=$(openssl rand -base64 64)"
echo "INTERNAL_API_SECRET=$(openssl rand -hex 32)"

# Edit file with your values
nano .env.production
```

**Minimum Required:**
- `JWT_SECRET` - Generated above
- `INTERNAL_API_SECRET` - Generated above
- `GEMINI_API_KEY` - From https://aistudio.google.com/app/apikey
- `NEXT_PUBLIC_MAPBOX_TOKEN` - From https://account.mapbox.com/access-tokens/
- `DB_PASS` - Strong password for database

### 3. Deploy

```bash
# Make script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 4. Access Application

```bash
# Get your IP
curl http://169.254.169.254/latest/meta-data/public-ipv4

# Access at:
http://YOUR_IP
```

---

## 📦 What Gets Deployed

| Service | Port | Description |
|---------|------|-------------|
| **Nginx** | 80 | Reverse proxy & load balancer |
| **Spring Boot** | 8080 | Core backend API |
| **FastAPI** | 8000 | ML engine & AI services |
| **Next.js** | 3000 | Web application |
| **PostgreSQL** | 5432 | Database with PostGIS |
| **Redis** | 6379 | Cache & session store |
| **Kafka** | 9092 | Event streaming |
| **Zookeeper** | 2181 | Kafka coordination |

---

## 🔧 Common Commands

```bash
# View status
./status.sh

# View logs
./logs.sh all              # All services
./logs.sh backend          # Specific service
./logs.sh backend 100      # Last 100 lines

# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Stop all
docker-compose -f docker-compose.prod.yml down

# Start all
docker-compose -f docker-compose.prod.yml up -d

# Backup database
./backup.sh

# Restore database
./restore.sh backups/vahansync_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🐛 Quick Troubleshooting

### Service won't start?
```bash
./logs.sh <service-name>
docker-compose -f docker-compose.prod.yml restart <service-name>
```

### Out of memory?
```bash
# Check usage
docker stats

# Add swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Database issues?
```bash
# Check PostgreSQL
./logs.sh postgres

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db
```

### Can't access from browser?
```bash
# Check firewall
sudo ufw status

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 🔒 Security Checklist

- [ ] Changed default database password
- [ ] Generated strong JWT secret
- [ ] Generated strong internal API secret
- [ ] Configured firewall (ports 80, 443, 22 only)
- [ ] Disabled SSH password authentication
- [ ] Set up SSL/HTTPS (see DEPLOYMENT.md)
- [ ] Configured automated backups
- [ ] Set up monitoring

---

## 📚 Full Documentation

For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🆘 Need Help?

1. Check logs: `./logs.sh all`
2. Check status: `./status.sh`
3. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
4. Check [Troubleshooting section](./DEPLOYMENT.md#troubleshooting)

---

**🚀 You're all set! Your LoadSetu application is running.**
