# Database Management Scripts

Quick reference for database management scripts and npm commands.

## NPM Scripts (Recommended)

### Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migrate:dev` | Run pending migrations (development) |
| `npm run migrate:test` | Run pending migrations (test) |
| `npm run migrate:prod` | Run pending migrations (production) |
| `npm run migrate:status:dev` | Check migration status (development) |
| `npm run migrate:status:test` | Check migration status (test) |
| `npm run migrate:status:prod` | Check migration status (production) |

### Seeding Commands

| Command | Description |
|---------|-------------|
| `npm run seed:dev` | Seed development database |
| `npm run seed:test` | Seed test database |
| `npm run seed:prod` | Seed production database |
| `npm run seed:undo:dev` | Undo all seeders (development) |
| `npm run seed:undo:test` | Undo all seeders (test) |
| `npm run seed:undo:prod` | Undo all seeders (production) |

### Automated Workflow Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `npm run reset:dev` | Undo seeders → Migrate → Seed | After changing seeder files |
| `npm run reset:test` | Undo seeders → Migrate → Seed | Need fresh data, keep schema |
| `npm run reset:prod` | Undo seeders → Migrate → Seed | ⚠️ Production data refresh |
| `npm run fresh:dev` | Drop all → Migrate → Seed | After changing migrations |
| `npm run fresh:test` | Drop all → Migrate → Seed | Database schema corrupted |
| `npm run fresh:prod` | Drop all → Migrate → Seed | ⚠️ Complete production rebuild |

## Standalone Scripts

Located in `SERVER/scripts/db/`:

### reset-database.js

Resets database with fresh seeded data (keeps schema):

```bash
node scripts/db/reset-database.js dev
node scripts/db/reset-database.js test
node scripts/db/reset-database.js prod
```

**Steps:**
1. Undo all seeders
2. Run pending migrations
3. Seed database

### fresh-database.js

Completely rebuilds database from scratch:

```bash
node scripts/db/fresh-database.js dev
node scripts/db/fresh-database.js test
node scripts/db/fresh-database.js prod
```

**Steps:**
1. Undo all migrations (drops all tables)
2. Run all migrations (recreates schema)
3. Seed database

⚠️ Requires confirmation for production environment.

## Seeded Data

All environments are seeded with identical structure:

### Users
- **Development**: `georzaza_dev` (Geo_Dev Zaza_Dev)
- **Test**: `georzaza_test` (Geo_Test Zaza_Test)
- **Email**: `georzaza@gmail.com` (same for both)
- **Password**: `6u1nxqD6a!` (same for both)

### Projects (2 per user)
1. **Test_Dev** / **Test_Test**
   - Description: Test_Description_Dev / Test_Description_Test
2. **Project2_Dev** / **Project2_Test**
   - Description: Second project for Dev/Test environment

### Salesforce Orgs (2 per project = 4 total)

#### Superbadge: Formulas
- **Connection**: Credentials + OAuth
- **Username**: `gzazanis@deloitte.gr_superbadge_formulas`
- **Password**: `6u1nxqD6a@`
- **Security Token**: `zKDXzphgZaWxeSdivLEmkxB53`
- **Login URL**: https://deloittegrsuperbadgeformula-dev-ed.develop.my.salesforce.com
- **Client ID**: `3MVG9YFqzc_KnL.yKgyiri.fuca75.r.8qiAz8d_FIEy09rnsWIXi3b.KlZfHrqRQzY6MaUBcGmrlC3MSO969`
- **Client Secret**: `37B38F0ECA9761FCD1802354D6BBA8E784F9E656C84818025A0151FB7A395D08`

#### Superbadge: Apex Web Services
- **Connection**: Credentials
- **Username**: `gzazanis@deloitte.gr_superbadge_apex_web_services`
- **Password**: `6u1nxqD6a!`
- **Security Token**: `aoUzg5oH5F20AG50xiEdTfLg`
- **Login URL**: https://deloittegrsuperbadgeape-12f-dev-ed.develop.my.salesforce.com

⚠️ **Note**: Orgs are identical across all environments for consistency.

## Common Workflows

### After Changing a Migration

```bash
# Fresh rebuild
npm run fresh:dev
npm run fresh:test
```

### After Changing Seeders

```bash
# Just reseed
npm run reset:dev
npm run reset:test
```

### Starting Fresh Development

```bash
# Complete fresh start
npm run fresh:dev

# Start server
npm run serve
```

### Before Running Tests

```bash
# Ensure test database is clean
npm run fresh:test

# Run tests
npm test
```

### Production Deployment

```bash
# Run migrations only (don't drop!)
npm run migrate:prod

# Optionally seed (if empty database)
npm run seed:prod
```

## Verification Commands

Check what's in the database:

```bash
# Check migration status
npm run migrate:status:dev

# List orgs in database
node scripts/db/list-orgs.js

# Check tables
node scripts/db/check-tables.js

# Verify database connection
node scripts/db/verify-db.js

# Check org credentials
node scripts/db/check-org-credentials.js <orgId>
```

## Direct SQL Access

```bash
# Development
psql -U postgres -d sf_migrator_dev

# Test
psql -U postgres -d sf_migrator_test

# Production
psql -U postgres -d sf_migrator_prod
```

### Useful SQL Queries

```sql
-- List all users
SELECT username, firstname, lastname, email FROM "Users";

-- List all projects
SELECT name, description, "userId" FROM "Projects";

-- List all orgs
SELECT name, "loginURL", "connectionType", username FROM "SfOrgs";

-- Count records
SELECT 
    (SELECT COUNT(*) FROM "Users") as users,
    (SELECT COUNT(*) FROM "Projects") as projects,
    (SELECT COUNT(*) FROM "SfOrgs") as orgs;
```

## Troubleshooting

### "Seeder already ran"

```bash
# Undo specific seeder
npm run seed:undo:dev

# Or undo all and reseed
npm run reset:dev
```

### "Migration already ran"

```bash
# Check status
npm run migrate:status:dev

# If corrupted, fresh rebuild
npm run fresh:dev
```

### "Connection refused"

1. Check PostgreSQL is running
2. Verify database exists
3. Check credentials in `.env.<environment>`

```bash
# Check if database exists
psql -U postgres -l | grep sf_migrator

# Verify connection
node scripts/db/verify-db.js
```

## Best Practices

✅ **DO**:
- Use `npm run reset:dev` after changing seeders
- Use `npm run fresh:dev` after changing migrations
- Run `npm run fresh:test` before test suites
- Commit migration files to git
- Test migrations on dev/test before production

❌ **DON'T**:
- Commit `.env` files
- Run `fresh:prod` without backup
- Edit migration files after they've run in production
- Skip testing migrations in dev/test first
- Use development credentials in production

---

**Last Updated**: February 8, 2026
**Location**: `SERVER/scripts/db/README.md`
