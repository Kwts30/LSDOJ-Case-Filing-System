#!/bin/bash
# MongoDB Backup Script for DOJ Case Filing System
# This script should be run via cron on a worker or backup server
# Example cron: 0 2 * * * /path/to/backup.sh >> /var/log/doj-backup.log 2>&1

set -e

# Configuration
# Read URI from environment or define here if secure
MONGO_URI=${MONGODB_URI:-"mongodb+srv://user:password@cluster.mongodb.net/"}
DB_NAME="doj-case-filing"
BACKUP_DIR="/var/backups/mongodb/doj"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="${DB_NAME}_${DATE}.gz"
RETENTION_DAYS=7

echo "Starting database backup at $(date)"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Perform mongodump
mongodump --uri="$MONGO_URI" --db="$DB_NAME" --archive="$BACKUP_DIR/$ARCHIVE_NAME" --gzip

if [ $? -eq 0 ]; then
  echo "Backup successful: $BACKUP_DIR/$ARCHIVE_NAME"
else
  echo "Backup failed!"
  exit 1
fi

# Clean up old backups
echo "Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.gz" -mtime +$RETENTION_DAYS -exec rm {} \;

echo "Backup process completed at $(date)"
