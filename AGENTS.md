# AGENTS

## Scope
This file guides AI coding agents working in this repository only.
Repository: Mandibula-back (Express, TypeScript, Prisma, PostgreSQL, Vitest).

## Fast Start
- Install: `pnpm install`
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Start built server: `pnpm start`
- Lint: `pnpm lint`
- Lint fix: `pnpm lint:fix`
- Format: `pnpm format`
- Test: `pnpm test`
- Prisma generate: `pnpm prisma:generate`
- Prisma migrate (dev): `pnpm prisma:migrate`
- Seed DB: `pnpm prisma:db:seed`

## Architecture Map
- Server bootstrap: [src/index.ts](src/index.ts), [src/server.ts](src/server.ts)
- Routes: [src/routes](src/routes)
- Controllers: [src/controllers](src/controllers)
- Services and business logic: [src/services](src/services)
- Middleware (auth/validation/etc): [src/middleware](src/middleware)
- Shared libs (Prisma, auth, integrations): [src/lib](src/lib)
- Validation schemas: [src/validations](src/validations)
- Database schema and migrations: [prisma/schema.prisma](prisma/schema.prisma), [prisma/migrations](prisma/migrations)
- Seed scripts: [prisma/seed](prisma/seed)

## Conventions For Agents
- Keep route handlers thin and place business logic in services.
- Validate request payloads with Zod at route boundaries.
- Preserve existing error handling style (structured JSON errors in centralized middleware).
- Keep TypeScript strictness; avoid `any` unless there is no practical alternative.
- Use Prisma through shared library patterns in [src/lib](src/lib).

## Common Pitfalls
- `pnpm build` depends on Prisma client generation; keep `prisma generate` in build-related changes.
- Some flows fail if seed data is missing in staging/preprod; seed before debugging order/cart behaviors.
- Dev/staging scripts also rely on `NODE_OPTIONS=--max-http-header-size=131072`; preserve this unless there is a strong reason.
- Be careful when changing auth or CORS behavior because frontend relies on compatible cookie/header flows.

## Documentation To Link (Do Not Duplicate)
- Primary project context: [docPerso/COPILOT-CONTEXT.md](docPerso/COPILOT-CONTEXT.md)
- Rate limit and Copilot usage notes: [docPerso/GUIDE-COPILOT-RATELIMIT.md](docPerso/GUIDE-COPILOT-RATELIMIT.md)
- Seed guide: [docPerso/GUIDE_SEED.md](docPerso/GUIDE_SEED.md)
- Preprod orders debugging: [docPerso/DEBUG-ORDERS-PREPROD.md](docPerso/DEBUG-ORDERS-PREPROD.md)
- Frontend Zod error mapping: [docPerso/FRONTEND-ZOD-ERRORS.md](docPerso/FRONTEND-ZOD-ERRORS.md)
- Sprint implementation references: [docPerso/INDEX-SPRINT1-UPDATES.md](docPerso/INDEX-SPRINT1-UPDATES.md)

## CI Note
- Existing CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- CI currently targets `main` and `Auth` branches; if you adjust branch strategy, update workflow filters.

## Change Hygiene
- Make targeted edits and avoid broad refactors unless requested.
- Run lint/tests for the touched area before finalizing.
- Prefer additive, low-risk changes in API-critical paths.
