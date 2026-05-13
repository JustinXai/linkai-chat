#!/bin/bash
#
# MongoDB Backup Script for Link-AI Chat
#
# Usage: ./mongodb-backup.sh
#
# Environment variables:
#   MONGODB_URI      - MongoDB connection string (required)
#   BACKUP_DIR       - Backup directory (default: /opt/linkai/backups/mongodb)
#   RETENTION_DAYS   - Backup retention days (default: 7)
#   DB_NAME          - Database name to backup (default: extracted from MONGODB_URI or 'librechat')
#
# Example:
#   MONGODB_URI="mongodb://user:password@localhost:27017" ./mongodb-backup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/linkai/backups/mongodb}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/linkai_backup_${TIMESTAMP}.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "${GREEN}${1}${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}${1}${NC}"
}

log_error() {
    log "ERROR" "${RED}${1}${NC}"
}

# Extract database name from MONGODB_URI
extract_db_name() {
    local uri="$1"
    local db_name="${DB_NAME:-}"

    if [ -n "${db_name}" ]; then
        echo "${db_name}"
        return
    fi

    # Try to extract from URI path
    if [[ "$uri" =~ /([^/]+)(\?|$) ]]; then
        db_name="${BASH_REMATCH[1]}"
    fi

    # Default to librechat if not found
    echo "${db_name:-librechat}"
}

# Check prerequisites
check_prerequisites() {
    # Check if mongodump is available
    if ! command -v mongodump &> /dev/null; then
        log_error "mongodump not found. Please install MongoDB Database Tools."
        log_error "On Ubuntu/Debian: sudo apt-get install mongodb-database-tools"
        log_error "On macOS: brew install mongodb-database-tools"
        exit 1
    fi

    # Check if MONGODB_URI is set
    if [ -z "${MONGODB_URI}" ]; then
        log_error "MONGODB_URI environment variable is not set."
        log_error "Please set your MongoDB connection string:"
        log_error "  export MONGODB_URI=\"mongodb://user:password@host:27017\""
        exit 1
    fi

    # Check if mongodump can connect
    if ! mongodump --uri="${MONGODB_URI}" --quiet --dryRun &> /dev/null; then
        log_warn "MongoDB connection test failed. Backup may not succeed."
    fi
}

# Create backup directory
setup_backup_dir() {
    if [ ! -d "${BACKUP_DIR}" ]; then
        log_info "Creating backup directory: ${BACKUP_DIR}"
        mkdir -p "${BACKUP_DIR}"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    local deleted=0
    while IFS= read -r backup; do
        if [ -f "${backup}" ]; then
            rm -f "${backup}"
            log_info "Deleted: ${backup}"
            ((deleted++))
        fi
    done < <(find "${BACKUP_DIR}" -name "linkai_backup_*.gz" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true)

    if [ ${deleted} -eq 0 ]; then
        log_info "No old backups to clean up."
    else
        log_info "Cleaned up ${deleted} old backup(s)."
    fi
}

# Perform backup
perform_backup() {
    local db_name
    db_name=$(extract_db_name "${MONGODB_URI}")

    log_info "Starting MongoDB backup..."
    log_info "Database: ${db_name}"
    log_info "Output file: ${BACKUP_FILE}"

    # Run mongodump with compression
    if mongodump \
        --uri="${MONGODB_URI}" \
        --db="${db_name}" \
        --archive="${BACKUP_FILE}" \
        --gzip \
        --quiet; then

        # Verify backup file was created
        if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
            local size
            size=$(du -h "${BACKUP_FILE}" | cut -f1)
            log_info "Backup completed successfully!"
            log_info "Backup file: ${BACKUP_FILE}"
            log_info "Backup size: ${size}"
        else
            log_error "Backup file was not created or is empty."
            exit 1
        fi
    else
        log_error "Backup failed with error code: $?"
        log_error "Please check MONGODB_URI and ensure MongoDB is accessible."
        exit 1
    fi
}

# Print restore instructions
print_restore_instructions() {
    local latest_backup
    latest_backup=$(find "${BACKUP_DIR}" -name "linkai_backup_*.gz" -type f -mtime -1 | head -n1)

    echo ""
    echo "============================================"
    echo -e "${GREEN}Backup completed successfully!${NC}"
    echo "============================================"
    echo ""
    echo -e "${YELLOW}Restore Instructions:${NC}"
    echo ""
    echo "1. Restore to the same database:"
    echo "   mongorestore --uri=\"${MONGODB_URI}\" --gzip --archive=\"${BACKUP_FILE}\" --drop"
    echo ""
    echo "2. Restore to a different database:"
    echo "   mongorestore --uri=\"mongodb://host:27017\" --gzip --archive=\"${BACKUP_FILE}\" --nsFrom=\"librechat.*\" --nsTo=\"newdb.*\""
    echo ""
    echo "3. List backup files:"
    echo "   ls -lh ${BACKUP_DIR}/"
    echo ""
    echo "4. Check backup integrity:"
    echo "   mongorestore --uri=\"${MONGODB_URI}\" --gzip --archive=\"${BACKUP_FILE}\" --dryRun"
    echo ""
    echo "============================================"
}

# Main execution
main() {
    log_info "============================================"
    log_info "MongoDB Backup Script for Link-AI Chat"
    log_info "============================================"

    # Check prerequisites
    check_prerequisites

    # Setup backup directory
    setup_backup_dir

    # Cleanup old backups
    cleanup_old_backups

    # Perform backup
    if perform_backup; then
        print_restore_instructions
        log_info "Backup completed successfully!"
        exit 0
    else
        log_error "Backup failed!"
        exit 1
    fi
}

# Run main function
main "$@"
