#!/bin/bash

# ============================================================================
# LoadSetu / VahanSync — Database Restore Script
# ============================================================================

set -e

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: Please provide backup file path${NC}"
    echo "Usage: ./restore.sh <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh backups/vahansync_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠ WARNING: This will replace the current database!${NC}"
echo -e "${YELLOW}Backup file: $BACKUP_FILE${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

echo -e "${YELLOW}Starting database restore...${NC}"

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "Decompressing backup..."
    gunzip -c $BACKUP_FILE > /tmp/restore_temp.sql
    RESTORE_FILE="/tmp/restore_temp.sql"
else
    RESTORE_FILE=$BACKUP_FILE
fi

# Stop services that depend on database
echo "Stopping application services..."
docker-compose -f docker-compose.prod.yml stop backend ml-engine web

# Restore database
echo "Restoring database..."
cat $RESTORE_FILE | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ${DB_USER:-vahansync} ${DB_NAME:-vahansync_db}

# Clean up temp file
if [ -f "/tmp/restore_temp.sql" ]; then
    rm /tmp/restore_temp.sql
fi

# Restart services
echo "Restarting application services..."
docker-compose -f docker-compose.prod.yml start backend ml-engine web

echo -e "${GREEN}✓ Database restored successfully!${NC}"
echo -e "${YELLOW}Please verify the application is working correctly${NC}"
