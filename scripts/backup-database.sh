#!/bin/bash
# Database Backup Script

set -e

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="kilt_liquidity_portal_${DATE}.sql"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    exit 1
fi

echo "🗄️ Creating database backup..."

# Create the backup
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_DIR/$BACKUP_FILE"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo "✅ Database backup created: $BACKUP_DIR/$COMPRESSED_FILE"

# Remove old backups (older than RETENTION_DAYS)
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "🧹 Cleaned up backups older than $RETENTION_DAYS days"

# Optional: Upload to S3 if AWS credentials are configured
if [ ! -z "$BACKUP_S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "☁️ Uploading backup to S3..."
    aws s3 cp "$BACKUP_DIR/$COMPRESSED_FILE" "s3://$BACKUP_S3_BUCKET/backups/"
    echo "✅ Backup uploaded to S3: s3://$BACKUP_S3_BUCKET/backups/$COMPRESSED_FILE"
fi

echo "🎉 Backup process completed!"