"# WFH Attendance & Employee Monitoring

This repository contains the initial monorepo boilerplate for the two-scope application described in the PRD:

- Absensi WFH employee app
- HRD monitoring admin app

## Repository structure

- `apps/absensi-web` — employee-facing React app
- `apps/monitoring-web` — HRD-facing React app
- `packages/absensi-service` — NestJS attendance backend
- `packages/monitoring-service` — NestJS monitoring backend
- `docker-compose.yml` — MySQL 8 service for local development

## Docker-based setup

1. Copy `.env.example` to `.env`.
2. Set `INITIAL_HRD_ADMIN_EMAIL` and `INITIAL_HRD_ADMIN_PASSWORD` in `.env`. Use a unique password with at least 8 characters. `.env` is ignored by Git; do not commit it.
3. Start MySQL and build the services:
   ```bash
   docker compose up -d mysql
   docker compose build
   ```
4. Create the initial HRD admin:
   ```bash
   docker compose run --rm admin-bootstrap
   ```
   The command hashes the password with bcrypt and sets `must_change_password`. It does not print the password and will not overwrite an existing active account.
5. Start the application containers:
   ```bash
   docker compose up --build -d
   ```
   The one-off `schema-migrate` container runs monitoring migrations first, then attendance migrations; the APIs wait for it to finish successfully.
6. (Optional) Seed demo employees, accounts, and attendance. Set `DEMO_EMPLOYEE_PASSWORD` in `.env`, then run:
   ```bash
   docker compose run --rm monitoring-demo-seed
   docker compose run --rm absensi-service npm run seed:demo
   ```
   The employee seed is repeat-safe and does not change existing employee or attendance records. Demo employee accounts require a password change on first login.
7. Access the apps:
   - Absensi Web: http://localhost:5173
   - Monitoring Web: http://localhost:5174
   - Absensi API: http://localhost:3001/api/v1
   - Monitoring API: http://localhost:3002/api/v1
   - MySQL: localhost:3306

The admin bootstrap applies monitoring migrations before inserting the admin. Migrations are additive and recorded in the shared TypeORM migration table. Do not delete a volume that contains data.

## TypeORM entities and migrations

Database models are TypeORM entities in each service's `src/database/entities` directory. Migrations are generated from those entities and reviewed before applying. Run monitoring migrations first on the shared database, then generate attendance migrations; attendance includes matching reference entities to preserve shared-table foreign keys without owning those tables:

```bash
npm run db:migration:generate --workspace=@wfh-attendance/monitoring-service -- src/database/migrations/DescribeChange -d src/database/data-source.ts
npm run db:migration:generate --workspace=@wfh-attendance/absensi-service -- src/database/migrations/DescribeChange -d src/database/migration-data-source.ts
npm run db:migrate --workspace=@wfh-attendance/monitoring-service
npm run db:migrate --workspace=@wfh-attendance/absensi-service
```

Attendance migrations only include attendance-owned entities; constraints to shared tables are kept explicitly in those migrations so the attendance service cannot alter monitoring-owned schema.

## Useful commands

```bash
# Start containers in the background
docker compose up -d --build

# Stop all containers
docker compose down

# Rebuild one service after code changes
docker compose build absensi-service

# View logs
docker compose logs -f absensi-service

# Seed 50 sample attendance rows for a small-scale smoke test (create an empty, separately granted DB ending in _perf first)
docker compose run --rm -e DB_NAME=wfh_attendance_perf monitoring-service npm run db:migrate
docker compose run --rm -e DB_NAME=wfh_attendance_perf -e PERFORMANCE_SEED_CONFIRM=YES absensi-service npm run seed:performance
```
It refuses to run unless the selected database ends in `_perf` and has an empty attendance table. This small seed is for development smoke tests, not for validating the PRD's production performance target.

## Current status

Sprint 0 (Foundation) and Sprint 1 (Data foundation) are complete. The repo includes the service-owned schema migrations, an environment-backed HRD bootstrap, and separate demo and performance seed scripts.

## Notes

The PRD defines strict architecture requirements around service boundaries, shared `users` table ownership, and API conventions. Employee snapshots are no longer used; attendance reads active employee eligibility from the shared `users` table, while monitoring resolves department filters before requesting attendance data."