#!/bin/bash

# ============================================================================
# LoadSetu / VahanSync — Production Deployment Script
# 
# This script automates the deployment process on EC2
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root"
    exit 1
fi

print_header "LoadSetu Deployment Script"

# ── Step 1: Check Prerequisites ─────────────────────────────────────────────
print_header "Step 1: Checking Prerequisites"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_success "Docker installed. Please log out and log back in, then run this script again."
    exit 0
else
    print_success "Docker is installed: $(docker --version)"
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    print_success "Docker Compose installed"
else
    print_success "Docker Compose is installed: $(docker-compose --version)"
fi

# Check if user is in docker group
if ! groups $USER | grep -q docker; then
    print_warning "User is not in docker group. Adding..."
    sudo usermod -aG docker $USER
    print_warning "Please log out and log back in for group changes to take effect"
    exit 0
fi

# ── Step 2: Environment Configuration ───────────────────────────────────────
print_header "Step 2: Environment Configuration"

if [ ! -f .env.production ]; then
    print_warning ".env.production not found. Creating from example..."
    cp .env.production.example .env.production
    print_error "Please edit .env.production with your actual values before continuing!"
    print_warning "Required values:"
    echo "  - JWT_SECRET (generate with: openssl rand -base64 64)"
    echo "  - INTERNAL_API_SECRET (generate with: openssl rand -hex 32)"
    echo "  - GEMINI_API_KEY"
    echo "  - Database passwords"
    echo "  - API keys (Razorpay, Twilio, etc.)"
    echo ""
    echo "After editing, run this script again."
    exit 1
else
    print_success ".env.production found"
    
    # Check for placeholder values
    if grep -q "REPLACE_WITH" .env.production || grep -q "CHANGE_THIS" .env.production; then
        print_error "Found placeholder values in .env.production!"
        print_error "Please replace all REPLACE_WITH and CHANGE_THIS values"
        exit 1
    fi
    
    print_success "Environment file validated"
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# ── Step 3: Create Required Directories ────────────────────────────────────
print_header "Step 3: Creating Required Directories"

mkdir -p ssl
mkdir -p logs
mkdir -p backups

print_success "Directories created"

# ── Step 4: Stop Existing Containers ────────────────────────────────────────
print_header "Step 4: Stopping Existing Containers"

if [ "$(docker ps -q)" ]; then
    print_warning "Stopping running containers..."
    docker-compose -f docker-compose.prod.yml down
    print_success "Containers stopped"
else
    print_success "No running containers"
fi

# ── Step 5: Pull Latest Images ─────────────────────────────────────────────
print_header "Step 5: Pulling Base Images"

docker pull postgis/postgis:16-3.4
docker pull redis:7-alpine
docker pull confluentinc/cp-zookeeper:7.6.0
docker pull confluentinc/cp-kafka:7.6.0
docker pull nginx:alpine

print_success "Base images pulled"

# ── Step 6: Build Application Images ───────────────────────────────────────
print_header "Step 6: Building Application Images"

print_warning "Building Spring Boot Backend..."
docker-compose -f docker-compose.prod.yml build backend

print_warning "Building FastAPI ML Engine..."
docker-compose -f docker-compose.prod.yml build ml-engine

print_warning "Building Next.js Web App..."
docker-compose -f docker-compose.prod.yml build web

print_success "All application images built"

# ── Step 7: Start Services ─────────────────────────────────────────────────
print_header "Step 7: Starting Services"

docker-compose -f docker-compose.prod.yml up -d

print_success "Services started"

# ── Step 8: Wait for Services to be Healthy ────────────────────────────────
print_header "Step 8: Waiting for Services to be Healthy"

print_warning "This may take 2-3 minutes..."

# Wait for PostgreSQL
echo -n "Waiting for PostgreSQL..."
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U $DB_USER -d $DB_NAME &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Redis
echo -n "Waiting for Redis..."
for i in {1..20}; do
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Kafka
echo -n "Waiting for Kafka..."
for i in {1..40}; do
    if docker-compose -f docker-compose.prod.yml exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for Backend
echo -n "Waiting for Spring Boot Backend..."
for i in {1..60}; do
    if curl -sf http://localhost:8080/actuator/health &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 3
done

# Wait for ML Engine
echo -n "Waiting for FastAPI ML Engine..."
for i in {1..40}; do
    if curl -sf http://localhost:8000/health &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Web App
echo -n "Waiting for Next.js Web App..."
for i in {1..40}; do
    if curl -sf http://localhost:3000 &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Nginx
echo -n "Waiting for Nginx..."
for i in {1..20}; do
    if curl -sf http://localhost/health &> /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

print_success "All services are healthy!"

# ── Step 9: Display Status ─────────────────────────────────────────────────
print_header "Step 9: Deployment Status"

docker-compose -f docker-compose.prod.yml ps

# ── Step 10: Display Access Information ────────────────────────────────────
print_header "Deployment Complete! 🚀"

echo -e "${GREEN}Your LoadSetu application is now running!${NC}\n"

# Get EC2 public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

echo "Access URLs:"
echo "  • Web Application:  http://$PUBLIC_IP"
echo "  • Backend API:      http://$PUBLIC_IP/api/spring"
echo "  • ML Engine API:    http://$PUBLIC_IP/api/ai"
echo "  • Health Check:     http://$PUBLIC_IP/health"
echo ""

echo "Service Ports (internal):"
echo "  • Nginx:            80"
echo "  • Spring Boot:      8080"
echo "  • FastAPI:          8000"
echo "  • Next.js:          3000"
echo "  • PostgreSQL:       5432"
echo "  • Redis:            6379"
echo "  • Kafka:            9092"
echo ""

echo "Useful Commands:"
echo "  • View logs:        docker-compose -f docker-compose.prod.yml logs -f"
echo "  • Stop services:    docker-compose -f docker-compose.prod.yml down"
echo "  • Restart service:  docker-compose -f docker-compose.prod.yml restart <service>"
echo "  • View status:      docker-compose -f docker-compose.prod.yml ps"
echo ""

print_warning "Next Steps:"
echo "  1. Configure your domain DNS to point to: $PUBLIC_IP"
echo "  2. Set up SSL certificates (Let's Encrypt recommended)"
echo "  3. Configure firewall rules (allow ports 80, 443)"
echo "  4. Set up monitoring and backups"
echo "  5. Review logs for any errors"
echo ""

print_success "Deployment completed successfully!"
