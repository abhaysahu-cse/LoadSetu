#!/bin/bash

# ============================================================================
# LoadSetu / VahanSync — Status Check Script
# ============================================================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LoadSetu System Status${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Container Status
echo -e "${YELLOW}Container Status:${NC}"
docker-compose -f docker-compose.prod.yml ps
echo ""

# Health Checks
echo -e "${YELLOW}Health Checks:${NC}"

check_service() {
    SERVICE_NAME=$1
    URL=$2
    
    if curl -sf $URL > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} $SERVICE_NAME is healthy"
    else
        echo -e "  ${RED}✗${NC} $SERVICE_NAME is not responding"
    fi
}

check_service "Nginx" "http://localhost/health"
check_service "Spring Boot Backend" "http://localhost:8080/actuator/health"
check_service "FastAPI ML Engine" "http://localhost:8000/health"
check_service "Next.js Web App" "http://localhost:3000"

echo ""

# Resource Usage
echo -e "${YELLOW}Resource Usage:${NC}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker-compose -f docker-compose.prod.yml ps -q)

echo ""

# Disk Usage
echo -e "${YELLOW}Docker Disk Usage:${NC}"
docker system df

echo ""

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")

echo -e "${GREEN}Access URL: http://$PUBLIC_IP${NC}"
