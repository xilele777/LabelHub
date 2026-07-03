# Changelog

All notable changes to LabelHub will be documented in this file.

## [0.2.0] — 2026-07-03

### Security

- **Seed passwords now hashed with scrypt** (N=16384, r=8, p=1). Plaintext passwords in seed data are replaced with proper scrypt hashes.
- **Token storage moved to httpOnly cookie**. Frontend no longer persists authentication tokens in `localStorage`, eliminating XSS token theft risk. Backend auth middleware checks cookie first, Authorization header as fallback.
- **Rate limiters applied to sensitive endpoints**. `annotationSubmitLimiter` (30/min), `reviewActionLimiter` (30/min), `batchImportLimiter` (5/min), and `userCreateLimiter` (10/min) are now enforced on their respective routes.
- **Content-Security-Policy header added**. Restricts script, style, font, and connect sources to prevent XSS and data injection.
- **CSRF protection via SameSite cookies**. httpOnly auth cookies use `SameSite=Lax` to prevent cross-site request forgery.
- **Password change invalidates existing tokens**. `passwordChangedAt` field added to users table; tokens issued before the last password change are rejected.

### Added

- **Swagger/OpenAPI 3.0 API documentation** at `/api/docs`. Auto-generated from JSDoc annotations via `swagger-jsdoc`.
- **Prometheus metrics endpoint** at `/api/metrics`. Exposes HTTP request duration, total requests, in-flight requests, and Node.js default metrics.
- **Global Vue error boundary** (`app.config.errorHandler`). Catches unhandled render errors and reports to backend via `navigator.sendBeacon` in production.
- **Gzip/brotli response compression** via `compression` middleware. Reduces API response sizes by ~70%.
- **API retry mechanism** in Axios interceptor. Configurable exponential backoff with jitter for 5xx/429/network errors.
- **Bundle analysis** via `rollup-plugin-visualizer`. Outputs `dist/stats.html` with gzip/brotli size breakdowns.
- **Unit test frameworks** set up for both frontend (`vitest` + `@vue/test-utils` + `happy-dom`) and backend (`vitest`).
- **DB index on `annotation_items.reviewer`** for faster review workbench queries.
- **NotificationStore error/loading states** exposed to UI for better error handling.
- **Health check now probes DB and Redis**. Returns 503 with `status: "degraded"` when any dependency is unhealthy.

### Changed

- **SQL-level pagination for list endpoints**. `crudFactory.js` now uses `db.list()` with query-level pre-filters before applying RBAC memory filters, preventing OOM with large datasets.
- **Input validation added to submit/approve/reject/resubmit** routes in `annotationItems.js`, using `readString` and `isPlainObject` validators.

### Fixed

- **NotificationStore silent error swallowing**. API errors now properly set `error` ref for UI display.

## [0.1.0] — 2026-06-01

### Added

- Initial release: Vue 3 + Express + SQLite annotation collaboration platform.
- RBAC (owner/annotator/reviewer) with role guards.
- HMAC-signed custom token authentication.
- scrypt password hashing with legacy upgrade path.
- Optimistic (version number) + pessimistic (30min lock) concurrency control.
- AI-powered review engine with rule-based scoring.
- Real-time WebSocket notifications via Socket.IO.
- Docker Compose (PostgreSQL 16 + Redis 7) support.
- PM2 cluster mode for multi-process deployment.
- ESLint 9 + Prettier + Husky + lint-staged code quality tooling.
- GitHub Actions CI/CD pipeline (lint → typecheck → test → build).
- Docker multi-stage build.
- Pino structured logging with request ID tracing.
- Redis caching with graceful degradation.
- express-rate-limit with Redis-backed distributed rate limiting.
- Password policy enforcement (min 8 chars, letters + numbers required).
