#!/bin/bash

# ============================================================================
# LoadSetu / VahanSync — Database Backup Script
# ============================================================================

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/vahansync_backup_$TIMESTAMP.sql"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U ${DB_USER:-vahansync} ${DB_NAME:-vahansync_db} > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

echo -e "${GREEN}✓ Backup completed: ${BACKUP_FILE}.gz${NC}"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "vahansync_backup_*.sql.gz" -mtime +7 -delete

echo -e "${GREEN}✓ Old backups cleaned up${NC}"

# Display backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo -e "${GREEN}Backup size: $BACKUP_SIZE${NC}"
