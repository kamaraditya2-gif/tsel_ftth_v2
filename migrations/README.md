> ⚠️ **Deprecated.** Skema untuk server database TimescaleDB mandiri sekarang ada di
> [`database/migrations`](../database/migrations) dan dijalankan dengan `database/scripts/migrate.sh`.
> Lihat [`database/README.md`](../database/README.md). File di folder ini hanya disimpan sebagai riwayat
> untuk database PostgreSQL lama.

# Database Migrations

This directory contains SQL migration files to update the database schema.

## Running Migrations

### Option 1: Manual (Linux/Mac)
```bash
cd migrations
chmod +x run-migrations.sh
./run-migrations.sh
```

### Option 2: Manual (Windows PowerShell)
```powershell
cd migrations
.\run-migrations.ps1
```

### Option 3: Manual (Direct psql)
```bash
psql -h localhost -U mojojojo_user -d mojojojo_db -f 002_update_schema_to_latest.sql
```

### Option 4: Automatic with Docker Compose
Add this to your docker-compose.yml:

```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mojojojo_db
      POSTGRES_USER: mojojojo_user
      POSTGRES_PASSWORD: mojojojo_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d:ro

volumes:
  postgres_data:
```

The `docker-entrypoint-initdb.d` folder will automatically run all `.sql` files on first startup.

## Migration Files

- `001_default_users.sql` - Initial database setup with default users and roles
- `002_update_schema_to_latest.sql` - Updates schema to latest state (includes all changes from development)

## Important Notes

1. **For Fresh Production Deployment**: Run `001_default_users.sql` first, then `002_update_schema_to_latest.sql`
2. **For Existing Production**: Only run migrations that haven't been applied yet
3. **Backup First**: Always backup your database before running migrations
4. **Test Locally**: Test migrations on a local copy of production data first

## Environment Variables

The migration scripts use these environment variables:

- `DB_HOST` (default: localhost)
- `DB_PORT` (default: 5432)
- `DB_NAME` (default: mojojojo_db)
- `DB_USER` (default: mojojojo_user)
- `DB_PASSWORD` (default: mojojojo_password)
