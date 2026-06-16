# Migration runner script for Windows PowerShell
# This script runs all migration files in order

$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_PORT = $env:DB_PORT ?? "5432"
$DB_NAME = $env:DB_NAME ?? "mojojojo_db"
$DB_USER = $env:DB_USER ?? "mojojojo_user"
$DB_PASSWORD = $env:DB_PASSWORD ?? "mojojojo_password"

Write-Host "Running migrations for database: $DB_NAME"
Write-Host "=========================================="

# Get list of migration files sorted alphabetically
$migrations = Get-ChildItem -Path "migrations" -Filter "*.sql" | Sort-Object Name

if ($migrations.Count -eq 0) {
    Write-Host "No migration files found in migrations/ directory"
    exit 0
}

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $DB_PASSWORD

# Run each migration file
foreach ($migration in $migrations) {
    Write-Host "Running migration: $($migration.Name)"
    
    $result = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migration.FullName 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migration completed successfully: $($migration.Name)"
    } else {
        Write-Host "✗ Migration failed: $($migration.Name)"
        Write-Host $result
        exit 1
    }
    Write-Host ""
}

Write-Host "=========================================="
Write-Host "All migrations completed successfully!"
