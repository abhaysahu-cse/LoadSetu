# 🚀 LoadSetu EC2 Deployment Guide

## ✅ Current Status

### Local Testing Complete
- ✅ Docker infrastructure running (PostgreSQL, Redis, Kafka, Zookeeper)
- ✅ 138 demo loads seeded in database (100+ from MP cities)
- ✅ Spring Boot backend tested and working
- ✅ ML Engine tested and working
- ✅ All files ready for deployment

---

## 📦 What Will Happen on EC2

### **IMPORTANT: Docker Containers Are NOT Automatically Cloned**

When you clone the repository on EC2, you will get:
- ✅ Source code
- ✅ Dockerfiles
- ✅ docker-compose.prod.yml
- ✅ Configuration files
- ✅ Database migration scripts (including demo loads)

**You will NOT get:**
- ❌ Running Docker containers
- ❌ Database data
- ❌ Built Docker images

### **What You Need to Do on EC2:**

1. **Clone the repository** → Gets source code
2. **Run `./deploy.sh`** → Builds Docker images and starts containers
3. **Flyway migrations run automatically** → Creates tables and seeds demo loads

---

## 🔧 Step-by-Step EC2 Deployment

### **Step 1: Prepare Local Repository**

```bash
# Add all Docker deployment files
git add .env.production.example
git add docker-compose.prod.yml
git add nginx.conf
git add deploy.sh logs.sh status.sh backup.sh restore.sh
git add test-system-flow.sh test-deployment.sh
git add *.md

# Add Dockerfiles
git add loadsetu-web/Dockerfile loadsetu-web/.dockerignore
git add ml-engine/vahansync-ml/Dockerfile ml-engine/vahansync-ml/.dockerignore
git add vahansync-core-backend/vahansync/Dockerfile vahansync-core-backend/vahansync/.dockerignore

# Add demo load migration
git add vahansync-core-backend/vahansync/src/main/resources/db/migration/V5__seed_demo_loads_mp.sql

# Commit everything
git commit -m "Add Docker deployment infrastructure with demo loads"

# Push to main branch
git push origin main
```

---

### **Step 2: Launch EC2 Instance**

**Recommended Instance Type:**
- **t3.large** (2 vCPU, 8 GB RAM) - Minimum
- **t3.xlarge** (4 vCPU, 16 GB RAM) - Recommended for production

**Operating System:**
- Ubuntu 22.04 LTS or Amazon Linux 2023

**Security Group Rules:**
```
Inbound Rules:
- SSH (22) - Your IP only
- HTTP (80) - 0.0.0.0/0
- HTTPS (443) - 0.0.0.0/0
- Custom TCP (8080) - 0.0.0.0/0 (Backend API)
- Custom TCP (3000) - 0.0.0.0/0 (Web App)
- Custom TCP (8000) - 0.0.0.0/0 (ML Engine)
```

**Storage:**
- Minimum 30 GB SSD

---

### **Step 3: Connect to EC2 and Install Dependencies**

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install git -y

# Logout and login again for Docker group to take effect
exit
# SSH back in
ssh -i your-key.pem ubuntu@your-ec2-ip
```

---

### **Step 4: Clone Repository on EC2**

```bash
# Clone your repository
git clone https://github.com/your-username/LoadSetu.git
cd LoadSetu

# Verify files are present
ls -la docker-compose.prod.yml
ls -la deploy.sh
ls -la vahansync-core-backend/vahansync/src/main/resources/db/migration/V5__seed_demo_loads_mp.sql
```

---

### **Step 5: Configure Environment Variables**

```bash
# Copy example environment file
cp .env.production.example .env.production

# Edit environment file
nano .env.production
```

**Required Configuration:**

```bash
# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=vahansync_db
DB_USER=vahansync
DB_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_123

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE

# Internal API Secret (generate with: openssl rand -base64 32)
INTERNAL_API_SECRET=YOUR_GENERATED_INTERNAL_SECRET_HERE

# Gemini API Key (get from Google AI Studio)
GEMINI_API_KEY=your_gemini_api_key_here

# Mapbox Token (get from Mapbox)
MAPBOX_TOKEN=your_mapbox_token_here

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Kafka
KAFKA_BOOTSTRAP=kafka:9092

# Domain (your EC2 public IP or domain)
DOMAIN=your-ec2-ip-or-domain.com
```

**Generate Secrets:**

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Internal API Secret
openssl rand -base64 32
```

---

### **Step 6: Deploy with Docker Compose**

```bash
# Make scripts executable
chmod +x deploy.sh logs.sh status.sh backup.sh restore.sh test-deployment.sh

# Deploy (this will build images and start containers)
./deploy.sh
```

**What `deploy.sh` Does:**

1. ✅ Builds Docker images for:
   - Spring Boot backend
   - FastAPI ML engine
   - Next.js web app
2. ✅ Starts all 8 services:
   - Nginx (reverse proxy)
   - Spring Boot backend
   - FastAPI ML engine
   - Next.js web app
   - PostgreSQL + PostGIS
   - Redis
   - Kafka
   - Zookeeper
3. ✅ Runs Flyway migrations automatically (including V5 demo loads)
4. ✅ Seeds 100 demo loads into database

**Deployment takes 5-10 minutes** depending on EC2 instance size.

---

### **Step 7: Verify Deployment**

```bash
# Check all services are running
./status.sh

# Check logs
./logs.sh backend
./logs.sh ml-engine
./logs.sh web

# Test system
./test-deployment.sh
```

**Expected Output:**

```
✓ All 8 services running
✓ Backend health check passed
✓ ML Engine health check passed
✓ Web app health check passed
✓ Database has 100+ demo loads
✓ Loads available in all 5 MP cities
```

---

### **Step 8: Test API Endpoints**

```bash
# Get your EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

# Test backend health
curl http://$EC2_IP/api/health

# Test ML engine health
curl http://$EC2_IP/ml/health

# Test web app
curl http://$EC2_IP/

# Register a test driver
curl -X POST http://$EC2_IP/api/v1/auth/register-driver \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Driver",
    "phone": "+919876543210",
    "password": "Test@123",
    "truckNumber": "MP09AB1234",
    "capacityTons": 10.0
  }'

# Get nearby loads (Bhopal coordinates)
curl "http://$EC2_IP/api/v1/loads/nearby?lat=23.2599&lng=77.4126&radius=50"
```

---

## 🔄 How Docker Deployment Works

### **On Your Local Machine:**
```
Source Code + Dockerfiles + docker-compose.yml
         ↓
    Git Repository (GitHub)
```

### **On EC2 Instance:**
```
1. git clone → Downloads source code
         ↓
2. ./deploy.sh → Builds Docker images from Dockerfiles
         ↓
3. docker-compose up → Creates and starts containers
         ↓
4. Flyway migrations → Creates tables and seeds data
         ↓
5. Application running in containers
```

### **Key Points:**

1. **Docker images are built on EC2**, not transferred
2. **Database starts empty**, then Flyway runs migrations
3. **Demo loads are seeded automatically** via V5 migration
4. **Each service runs in its own container**
5. **Nginx routes traffic** to appropriate services

---

## 📊 Service Architecture on EC2

```
Internet
    ↓
Nginx (Port 80/443)
    ↓
    ├─→ /api/* → Spring Boot Backend (Port 8080)
    ├─→ /ml/* → FastAPI ML Engine (Port 8000)
    └─→ /* → Next.js Web App (Port 3000)
         ↓
    PostgreSQL (Port 5432)
    Redis (Port 6379)
    Kafka (Port 9092)
```

---

## 🔐 Security Checklist

Before going to production:

- [ ] Change all default passwords in `.env.production`
- [ ] Generate strong JWT_SECRET and INTERNAL_API_SECRET
- [ ] Restrict Security Group to specific IPs where possible
- [ ] Set up SSL/HTTPS with Let's Encrypt
- [ ] Enable CloudWatch monitoring
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Enable firewall (ufw)

---

## 🛠️ Useful Commands on EC2

```bash
# View all running containers
docker ps

# View logs for specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart a service
docker-compose -f docker-compose.prod.yml restart backend

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check database
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db

# Count demo loads
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db -c "SELECT COUNT(*) FROM loads WHERE status = 'AVAILABLE';"

# Backup database
./backup.sh

# Restore database
./restore.sh backup-2026-05-27.sql
```

---

## 🐛 Troubleshooting

### **Problem: Services not starting**

```bash
# Check logs
./logs.sh backend
./logs.sh ml-engine

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(80|443|8080|8000|3000|5432|6379|9092)'

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### **Problem: No demo loads in database**

```bash
# Check Flyway migrations
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db -c "SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC;"

# Manually run V5 migration if needed
docker-compose -f docker-compose.prod.yml exec postgres psql -U vahansync -d vahansync_db < vahansync-core-backend/vahansync/src/main/resources/db/migration/V5__seed_demo_loads_mp.sql
```

### **Problem: Out of memory**

```bash
# Check memory usage
free -h

# Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📈 Monitoring

### **Check System Health**

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Docker stats
docker stats

# Service status
./status.sh
```

### **Set Up CloudWatch (Optional)**

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

---

## 🎯 Summary

### **What You Need to Do:**

1. ✅ **Commit and push** all files to GitHub
2. ✅ **Launch EC2 instance** (t3.large or larger)
3. ✅ **Install Docker** and Docker Compose
4. ✅ **Clone repository** on EC2
5. ✅ **Configure `.env.production`** with secrets
6. ✅ **Run `./deploy.sh`** to build and start containers
7. ✅ **Test with `./test-deployment.sh`**

### **What Happens Automatically:**

- ✅ Docker images built from source code
- ✅ All 8 containers started
- ✅ Database tables created via Flyway
- ✅ 100 demo loads seeded automatically
- ✅ Services connected and ready

### **Total Time:**

- EC2 setup: 10-15 minutes
- Docker deployment: 5-10 minutes
- **Total: ~20-25 minutes**

---

## 🚀 Ready to Deploy!

Your LoadSetu system is ready for EC2 deployment. All files are prepared, demo loads are ready to be seeded, and the deployment process is fully automated.

**Next Step:** Commit and push to GitHub, then follow this guide on EC2!

---

*Created: May 27, 2026*
*Status: ✅ Ready for Production Deployment*
