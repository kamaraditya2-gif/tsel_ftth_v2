#!/bin/bash

# Migration runner script
# This script runs all migration files in order

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-mojo_db}
DB_USER=${DB_USER:-mojo_db_user}
DB_PASSWORD=${DB_PASSWORD:-mojo_db_password}

echo "Running migrations for database: $DB_NAME"
echo "=========================================="

# Get list of migration files sorted alphabetically
MIGRATIONS=$(ls migrations/*.sql 2>/dev/null | sort)

if [ -z "$MIGRATIONS" ]; then
    echo "No migration files found in migrations/ directory"
    exit 0
fi

# Run each migration file
for migration in $MIGRATIONS; do
    echo "Running migration: $migration"
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$migration"
    
    if [ $? -eq 0 ]; then
        echo "✓ Migration completed successfully: $migration"
    else
        echo "✗ Migration failed: $migration"
        exit 1
    fi
    echo ""
done

echo "=========================================="
echo "All migrations completed successfully!"
