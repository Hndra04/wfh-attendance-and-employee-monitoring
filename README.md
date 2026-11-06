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

## Authentication

Both APIs expose `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and `PATCH /api/v1/auth/me/password`. Monitoring accepts only `HRD_ADMIN`; Absensi accepts only `EMPLOYEE`. Login and refresh responses return the access token in JSON and set a rotating refresh token in a service-specific `HttpOnly`, `SameSite=Lax` cookie. Access tokens default to 15 minutes; refresh tokens last 7 days.

Set `JWT_ACCESS_TTL` to a duration such as `15m` or `1h`. Set `ABSENSI_WEB_ORIGIN` and `MONITORING_WEB_ORIGIN` when the frontends use non-default origins. `TRUSTED_PROXY_HOPS` defaults to `0`; configure it to the exact number of trusted reverse-proxy hops so login throttling uses the correct client IP. Failed-login limits are held in each API process, so multiple replicas require a shared rate-limit store.

Use unique, high-entropy `JWT_SECRET_ABSENSI` and `JWT_SECRET_MONITORING` values in `.env`; the Compose defaults are for local development only.

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

Sprints 0–2 (Foundation, Data foundation, and Authentication) are complete. Both APIs have role-specific authentication, refresh-token rotation, guarded profile/password endpoints, and authentication unit tests.

## Notes

The PRD defines strict architecture requirements around service boundaries, shared `users` table ownership, and API conventions. Employee snapshots are no longer used; attendance reads active employee eligibility from the shared `users` table, while monitoring resolves department filters before requesting attendance data."