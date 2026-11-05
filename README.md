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
2. Set `INITIAL_HRD_ADMIN_EMAIL` and `INITIAL_HRD_ADMIN_PASSWORD` in `.env`. Use a unique password with at least 12 characters. `.env` is ignored by Git; do not commit it.
3. Start MySQL and build the one-off admin bootstrap container:
   ```bash
   docker compose build admin-bootstrap
   docker compose up -d mysql
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
6. Access the apps:
   - Absensi Web: http://localhost:5173
   - Monitoring Web: http://localhost:5174
   - Absensi API: http://localhost:3001/api/v1
   - Monitoring API: http://localhost:3002/api/v1
   - MySQL: localhost:3306

The bootstrap command applies the initial TypeORM migration before inserting the admin, so it works with both fresh and existing database volumes. Do not delete a volume that contains data.

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
```

## Current status

This is the foundational boilerplate phase. The repo now includes the monorepo layout, NestJS service skeletons, Vite React shells, and a Docker Compose setup for the database and application services required by the PRD.

## Notes

The PRD defines strict architecture requirements around service boundaries, shared `users` table ownership, and API conventions. The next implementation step is to build the auth + data models and API contracts for each service."