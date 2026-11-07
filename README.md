# WFH Attendance & Employee Monitoring

This monorepo contains the employee WFH attendance app and the HRD monitoring app described in the PRD. Employees use Absensi WFH to record attendance; HRD uses Monitoring to manage employee accounts and review attendance.

## Repository structure

- `apps/absensi-web` — employee-facing React app
- `apps/monitoring-web` — HRD-facing React app
- `packages/absensi-service` — NestJS attendance backend
- `packages/monitoring-service` — NestJS monitoring backend
- `packages/ui` — shared accessible React components and styles
- `docker-compose.yml` — MySQL 8 service for local development

## Docker-based setup

The NestJS 12 tooling requires Node.js 22.22.3 or newer; all application Dockerfiles use the Node 22 image.

1. Copy `.env.example` to `.env`.
2. Set `INITIAL_HRD_ADMIN_EMAIL` and `INITIAL_HRD_ADMIN_PASSWORD` in `.env`. Use a unique password with at least 8 characters. `.env` is ignored by Git; do not commit it. The admin bootstrap runs automatically when you start the Compose stack.
3. Start MySQL and build the services:
   ```bash
   docker compose up -d mysql
   docker compose build
   ```
4. Start the application containers:
   ```bash
   docker compose up --build -d
   ```
   The one-off `schema-migrate` container runs monitoring migrations first, then attendance migrations; the APIs wait for it to finish successfully. The `admin-bootstrap` service also applies monitoring migrations, hashes the configured password with bcrypt, and creates the initial admin with `must_change_password` set. It does not print the password or overwrite an existing active account.
5. (Optional) Seed demo employees, accounts, and attendance. Set `DEMO_EMPLOYEE_PASSWORD` in `.env`, then run:
   ```bash
   docker compose run --rm demo-seed
   ```
   The employee seed is repeat-safe and does not change existing employee or attendance records. Demo employee accounts require a password change on first login.
6. Access the apps:
   - Absensi Web: http://localhost:5173
   - Monitoring Web: http://localhost:5174
   - Absensi API: http://localhost:3001/api/v1
   - Monitoring API: http://localhost:3002/api/v1
   - MySQL: localhost:3306

Migrations are additive and recorded in the shared TypeORM migration table. Keep the database volume if it contains data.

## Authentication

Both APIs expose `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, and `PATCH /api/v1/auth/me/password`. Monitoring accepts `HRD_ADMIN` accounts; Absensi accepts `EMPLOYEE` accounts. Login and refresh return an access token in JSON and rotate a service-specific refresh token in an `HttpOnly`, `SameSite=Lax` cookie. Access tokens expire after 15 minutes by default; refresh tokens last 7 days.

Set `JWT_ACCESS_TTL` to a duration such as `15m` or `1h`. Set `ABSENSI_WEB_ORIGIN` and `MONITORING_WEB_ORIGIN` when the frontends use non-default origins. `TRUSTED_PROXY_HOPS` defaults to `0`; configure it to the exact number of trusted reverse-proxy hops so login throttling uses the correct client IP. Failed-login limits are held in each API process, so multiple replicas require a shared rate-limit store.

Set unique, high-entropy values for `JWT_SECRET_ABSENSI` and `JWT_SECRET_MONITORING` in `.env`. The Compose defaults are for local development only.
Monitoring calls the Absensi internal API over the Compose network with `INTERNAL_SERVICE_TOKEN`. In Compose, `ABSENSI_SERVICE_URL` defaults to `http://absensi-service:${PORT_ABSENSI}/api/v1`; change it if the service uses a different address.

## Shared UI foundation

Both React apps use `@wfh-attendance/ui` for buttons, labelled inputs and selects, badges, loading and empty states, toasts, dialogs, tables, pagination, date ranges, and protected routes. Its styles include keyboard focus indicators, responsive layouts, and reduced-motion support. The package uses the existing React and React Router dependencies.

## Employee management API

Under `/api/v1/employees`, the monitoring API lets HRD list, search, filter, create, update, change status, soft-delete, and reset employee accounts. Creating an account or resetting its password returns a temporary password once; the employee must change it at first login. To change a login email, call `PATCH /api/v1/employees/{id}/email` with `{ "email": "new@example.test", "confirm": true }`. The service updates the employee and linked account in one transaction.

The attendance service uses `GET /api/v1/internal/employees/{id}` to look up an employee and `GET /api/v1/internal/employees/ids?department=...` to resolve active IDs. Both routes require the `x-internal-service-token` header with the `INTERNAL_SERVICE_TOKEN` value.

## HRD attendance monitoring API

The monitoring API provides authenticated, read-only attendance routes:

- `GET /api/v1/attendances` supports `page`, `limit`, `employeeId`, `department`, `from`, `to`, `status`, and `sort` filters.
- `GET /api/v1/attendances/{id}` returns an attendance record with its employee profile.
- `GET /api/v1/attendances/{id}/photos/{kind}` streams its private photo; `kind` is `check-in` or `check-out`.
- `GET /api/v1/dashboard/summary` returns today's Jakarta-date counters and the seven-day attendance series.

For department filters, monitoring resolves active employee IDs and passes them to Absensi. It also proxies attendance details, photos, and dashboard data through the internal API. HRD clients never receive photo storage paths or filenames.

## Attendance API

The Absensi API provides these authenticated employee routes:

- `POST /api/v1/attendances/check-in` and `POST /api/v1/attendances/check-out` accept `multipart/form-data` with a required `photo` (JPEG or PNG, up to 5 MB). Check-in also accepts an optional `notes` field. The server records timestamps and calculates the Jakarta attendance date and late status.
- `GET /api/v1/attendances/today` returns today's record, or `data: null` if the employee has not checked in.
- `GET /api/v1/attendances/me` returns the employee's paginated history. Optional query parameters are `from`, `to` (`YYYY-MM-DD`), `page`, `limit` (maximum 100), and `sort` (`asc` or `desc`).
- `GET /api/v1/attendances/me/{attendanceId}` returns one of the employee's records.
- `GET /api/v1/attendances/me/{attendanceId}/photos/{kind}` streams that record's private photo; `kind` is `check-in` or `check-out`. Requests for another employee's photo return `403`.
- Internal read-only routes under `/api/v1/internal/attendances` provide HRD list/detail/photos and dashboard summary/series data to monitoring. They require the `x-internal-service-token` header and are not intended for browser clients.

Include the access token in the `Authorization` request header using the Bearer scheme. Photos are stored under `UPLOAD_DIR` (default `/app/uploads` in Docker) and are only served through these authenticated endpoints.

## Employee web app

At http://localhost:5173, employees can sign in, change a temporary password, check in and out with a photo, view attendance history and profile details, and sign out. Camera access requires HTTPS or localhost. A file picker is available if camera access cannot be used. Access tokens stay in memory; the API's HttpOnly refresh-token cookie restores the session.

The frontend reads `VITE_API_BASE_URL`. Docker Compose sets it to `http://localhost:${PORT_ABSENSI:-3001}/api/v1` for local development; update the `absensi-web` service environment if the API runs at a different origin.

## HRD monitoring web app

At http://localhost:5174, the bootstrapped HRD administrator can view today's attendance counts and the seven-day chart, search employees, manage accounts, and review attendance. The first sign-in requires a password change. Temporary employee passwords appear only after account creation or reset; copy them and send them through a secure channel.

The frontend reads `VITE_API_BASE_URL`. Docker Compose sets it to `http://localhost:${PORT_MONITORING:-3002}/api/v1` for local development; update the `monitoring-web` service environment if the API runs at a different origin.

## Release checks

The Swagger UI for each API is available at `/docs` on its API origin. Before a release, run the service tests and production builds:

```bash
npm test --workspace=@wfh-attendance/absensi-service
npm test --workspace=@wfh-attendance/monitoring-service
npm run build
```

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
```
