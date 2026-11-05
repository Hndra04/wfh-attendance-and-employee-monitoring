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

## Local setup

1. Copy `.env.example` to `.env` and adjust values as needed.
2. Start the database:
   ```bash
   npm run docker:up
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the apps:
   ```bash
   npm run dev:absensi-service
   npm run dev:monitoring-service
   npm run dev:absensi-web
   npm run dev:monitoring-web
   ```

## Current status

This is the foundational boilerplate phase. The repo now includes the monorepo layout, NestJS service skeletons, Vite React shells, and local Docker database config required by the PRD.

## Notes

The PRD defines strict architecture requirements around service boundaries, shared `users` table ownership, and API conventions. The next implementation step is to build the auth + data models and API contracts for each service."