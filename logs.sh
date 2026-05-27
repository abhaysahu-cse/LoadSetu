#!/bin/bash

# ============================================================================
# LoadSetu / VahanSync — Log Viewer Script
# ============================================================================

# Colors
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}LoadSetu Log Viewer${NC}\n"

if [ -z "$1" ]; then
    echo "Usage: ./logs.sh <service> [lines]"
    echo ""
    echo "Available services:"
    echo "  • all         - All services"
    echo "  • backend     - Spring Boot Backend"
    echo "  • ml-engine   - FastAPI ML Engine"
    echo "  • web         - Next.js Web App"
    echo "  • postgres    - PostgreSQL Database"
    echo "  • redis       - Redis Cache"
    echo "  • kafka       - Apache Kafka"
    echo "  • nginx       - Nginx Reverse Proxy"
    echo ""
    echo "Examples:"
    echo "  ./logs.sh all          # Follow all logs"
    echo "  ./logs.sh backend      # Follow backend logs"
    echo "  ./logs.sh backend 100  # Show last 100 lines of backend logs"
    exit 0
fi

SERVICE=$1
LINES=${2:-all}

if [ "$LINES" == "all" ]; then
    docker-compose -f docker-compose.prod.yml logs -f $SERVICE
else
    docker-compose -f docker-compose.prod.yml logs --tail=$LINES -f $SERVICE
fi
