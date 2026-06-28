# Provision Civils

A production-ready construction job management mobile app for field teams. Admins and supervisors manage jobs, employees, invoices, and daily reports; workers track their assigned work.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → proxied at `/api`)
- `pnpm --filter @workspace/provision-civils run dev` — run the Expo app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run first if lib types are stale)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (ESM, `.js` imports)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Mobile: Expo SDK 54, Expo Router v6, React Native 0.81
- Auth: JWT (via `SESSION_SECRET`), bcryptjs
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod schemas
- `lib/db/src/schema/` — Drizzle ORM schema (10 tables)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/provision-civils/app/` — Expo Router screens
- `artifacts/provision-civils/context/AuthContext.tsx` — JWT auth + user state
- `artifacts/provision-civils/constants/colors.ts` — design tokens (blue/orange/white)

## Architecture decisions

- Contract-first API: OpenAPI spec drives codegen for hooks + Zod schemas; server validates inputs with those schemas.
- JWT stored in AsyncStorage on mobile; `setAuthTokenGetter` injects it into every API request.
- All DB tables use `pgTable` with Drizzle; schema is in `lib/db` (shared lib), imported by API server routes.
- Invoice PDF uses React Native `Share.share()` (text format) — no binary PDF; expo-print removed due to breaking change in v15.0.8.
- Tabs use standard `expo-router` `Tabs` with `expo-blur` for iOS blur tab bar.

## Product

- **Login**: Role-based login (admin / supervisor / worker) with JWT
- **Dashboard**: Stats (active jobs, pending invoices, team count) + in-progress jobs feed
- **Jobs**: Full CRUD — list/filter/search, create, edit, view detail, photo capture, GPS logging, daily reports
- **Employees**: Create/edit team members with roles
- **Invoices**: Generate from job, share via Share API, status tracking
- **Notifications**: Read/unread alerts with badge count
- **Settings**: Dark/light mode toggle, profile info, logout

## Seeded accounts

| Email | Password | Role |
|---|---|---|
| admin@provision.co.za | admin123 | admin |
| supervisor@provision.co.za | super123 | supervisor |
| worker@provision.co.za | work123 | worker |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **expo-print v15.0.8** is broken (ENOENT on android/src/main tmp path) — do not reinstall; use Share API instead.
- **expo-sharing v14.x** was also removed; not needed with Share API.
- **lib types stale**: if API server can't find DB exports, run `pnpm run typecheck:libs` to rebuild declarations.
- **useListJobs params**: the hook takes params as the **first arg**, not as `{ params: ... }` — e.g. `useListJobs({ status: "pending" })`.
- **login API**: the generated `login()` function takes `LoginInput` directly (not `{ data: LoginInput }`); only the `useLogin` mutation hook wraps it in `{ data }`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
