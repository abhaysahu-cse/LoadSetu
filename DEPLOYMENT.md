# LoadSetu / VahanSync — Production Deployment Guide

Complete guide for deploying LoadSetu to AWS EC2 using Docker Compose.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [EC2 Setup](#ec2-setup)
3. [Deployment Steps](#deployment-steps)
4. [Configuration](#configuration)
5. [SSL/HTTPS Setup](#sslhttps-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### Local Requirements
- Git installed
- SSH key for EC2 access
- All API keys and secrets ready

### AWS Requirements
- AWS Account with EC2 access
- EC2 instance (recommended: t3.xlarge or larger)
- Security group configured (ports 80, 443, 22)
- Elastic IP (optional but recommended)

### API Keys Needed
- ✅ Gemini API Key (https://aistudio.google.com/app/apikey)
- ✅ Mapbox Token (https://account.mapbox.com/access-tokens/)
- ✅ Razorpay Keys (https://dashboard.razorpay.com/app/keys)
- ✅ Twilio Credentials (https://console.twilio.com)
- ✅ Meta WhatsApp Token (https://developers.facebook.com/apps)
- ✅ ULIP API Key (if available)

---

## 🖥️ EC2 Setup

### 1. Launch EC2 Instance

**Recommended Specifications:**
- **Instance Type**: t3.xlarge (4 vCPU, 16 GB RAM)
- **OS**: Ubuntu 22.04 LTS
- **Storage**: 50 GB gp3 SSD (minimum)
- **Region**: Choose closest to your users

**Security Group Rules:**
```
Inbound Rules:
- Port 22 (SSH) - Your IP only
- Port 80 (HTTP) - 0.0.0.0/0
- Port 443 (HTTPS) - 0.0.0.0/0

Outbound Rules:
- All traffic - 0.0.0.0/0
```

### 2. Connect to EC2

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 3. Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget htop
```

---

## 🚀 Deployment Steps

### Step 1: Clone Repository

```bash
cd ~
git clone https://github.com/your-org/LoadSetu.git
cd LoadSetu
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.production.example .env.production

# Edit with your actual values
nano .env.production
```

**Critical Values to Set:**

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate internal API secret
openssl rand -hex 32

# Set database password
DB_PASS=your_strong_password_here

# Add all API keys
GEMINI_API_KEY=your_key
NEXT_PUBLIC_MAPBOX_TOKEN=your_token
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
# ... etc
```

### Step 3: Run Deployment Script

```bash
# Make scripts executable
chmod +x deploy.sh logs.sh status.sh backup.sh restore.sh

# Run deployment
./deploy.sh
```

The script will:
1. ✅ Install Docker & Docker Compose
2. ✅ Validate environment configuration
3. ✅ Pull base images
4. ✅ Build application images
5. ✅ Start all services
6. ✅ Wait for health checks
7. ✅ Display access information

**Deployment takes 5-10 minutes** depending on your internet speed.

### Step 4: Verify Deployment

```bash
# Check all services are running
./status.sh

# View logs
./logs.sh all

# Test endpoints
curl http://localhost/health
curl http://localhost:8080/actuator/health
curl http://localhost:8000/health
```

---

## ⚙️ Configuration

### Environment Variables

All configuration is in `.env.production`. Key sections:

#### Database
```bash
DB_NAME=vahansync_db
DB_USER=vahansync
DB_PASS=strong_password_here
```

#### Security (CRITICAL)
```bash
JWT_SECRET=<512-bit base64 secret>
INTERNAL_API_SECRET=<64-char hex secret>
```

#### AI/ML
```bash
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash-exp
```

#### Frontend
```bash
NEXT_PUBLIC_APP_URL=http://your-domain.com
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```

### Updating Configuration

```bash
# Edit environment
nano .env.production

# Restart affected services
docker-compose -f docker-compose.prod.yml restart backend ml-engine web
```

---

## 🔒 SSL/HTTPS Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Stop Nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com -d www.your-domain.com

# Copy certificates
sudo mkdir -p ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/
sudo chown -R $USER:$USER ssl/

# Update nginx.conf (uncomment HTTPS server block)
nano nginx.conf

# Restart Nginx
docker-compose -f docker-compose.prod.yml start nginx
```

### Option 2: Custom SSL Certificate

```bash
# Place your certificates
mkdir -p ssl
cp your-fullchain.pem ssl/fullchain.pem
cp your-privkey.pem ssl/privkey.pem

# Update nginx.conf
nano nginx.conf  # Uncomment HTTPS block

# Restart Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Auto-Renewal (Let's Encrypt)

```bash
# Add cron job
sudo crontab -e

# Add this line (runs daily at 2 AM)
0 2 * * * certbot renew --quiet && docker-compose -f /home/ubuntu/LoadSetu/docker-compose.prod.yml restart nginx
```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# All services
./logs.sh all

# Specific service
./logs.sh backend
./logs.sh ml-engine
./logs.sh web

# Last 100 lines
./logs.sh backend 100
```

### Check Status

```bash
./status.sh
```

Output shows:
- Container status
- Health checks
- Resource usage (CPU, Memory)
- Disk usage
- Access URL

### Database Backups

```bash
# Manual backup
./backup.sh

# Restore from backup
./restore.sh backups/vahansync_backup_20250527_120000.sql.gz
```

**Automated Backups:**

```bash
# Add to crontab
crontab -e

# Daily backup at 3 AM
0 3 * * * cd /home/ubuntu/LoadSetu && ./backup.sh
```

### Service Management

```bash
# Restart a service
docker-compose -f docker-compose.prod.yml restart backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

---

## 🔍 Troubleshooting

### Service Won't Start

```bash
# Check logs
./logs.sh <service-name>

# Check if port is in use
sudo netstat -tulpn | grep <port>

# Restart service
docker-compose -f docker-compose.prod.yml restart <service-name>
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
./logs.sh postgres

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean Docker resources
docker system prune -a --volumes

# Remove old logs
find logs/ -name "*.log" -mtime +7 -delete
```

### Backend API Not Responding

```bash
# Check backend health
curl http://localhost:8080/actuator/health

# Check backend logs
./logs.sh backend

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### ML Engine Issues

```bash
# Check Gemini API key
grep GEMINI_API_KEY .env.production

# Check ML engine logs
./logs.sh ml-engine

# Test ML engine
curl http://localhost:8000/health
```

### Nginx 502 Bad Gateway

```bash
# Check upstream services
curl http://localhost:8080/actuator/health
curl http://localhost:8000/health
curl http://localhost:3000

# Check Nginx logs
./logs.sh nginx

# Restart Nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

---

## 📈 Performance Optimization

### Database Tuning

Already configured in `docker-compose.prod.yml`:
- max_connections: 200
- shared_buffers: 256MB
- effective_cache_size: 1GB

### Redis Tuning

Already configured:
- maxmemory: 512MB
- maxmemory-policy: allkeys-lru
- appendonly: yes

### Application Tuning

**Spring Boot (Backend):**
- JVM heap: 512MB - 2GB
- G1GC garbage collector

**FastAPI (ML Engine):**
- Workers: 4 (adjust based on CPU cores)

**Next.js (Web):**
- Standalone output for minimal size
- Static asset caching

---

## 🔐 Security Best Practices

1. **Change Default Passwords**
   - Database password
   - Redis password (if enabled)

2. **Restrict SSH Access**
   - Use key-based authentication only
   - Disable password authentication
   - Limit to specific IPs

3. **Enable Firewall**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

4. **Regular Updates**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Update Docker images
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. **Monitor Logs**
   - Set up log rotation
   - Monitor for suspicious activity
   - Use CloudWatch or similar

---

## 📞 Support

For issues or questions:
- Check logs: `./logs.sh all`
- Check status: `./status.sh`
- Review this guide
- Contact: support@loadsetu.in

---

## 📝 Quick Reference

```bash
# Deploy
./deploy.sh

# Status
./status.sh

# Logs
./logs.sh <service>

# Backup
./backup.sh

# Restore
./restore.sh <backup-file>

# Restart service
docker-compose -f docker-compose.prod.yml restart <service>

# Stop all
docker-compose -f docker-compose.prod.yml down

# Start all
docker-compose -f docker-compose.prod.yml up -d
```

---

**🎉 Your LoadSetu application is now deployed and running!**
