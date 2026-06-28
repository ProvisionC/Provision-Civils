---
name: DB lib stale declarations
description: When the API server can't find DB table exports, the lib declarations are stale and need rebuilding.
---

**Rule:** Run `pnpm run typecheck:libs` before leaf-package typechecks whenever `@workspace/db` schema has changed.

**Why:** The API server imports from `@workspace/db` via compiled `.d.ts` declarations in `lib/db/dist/`. If the lib hasn't been built yet (fresh clone, new schema file added), tsc reports "Module has no exported member 'xTable'" even though the source exports are correct.

**How to apply:** If you see TS2305 errors like "Module '@workspace/db' has no exported member 'invoicesTable'", run `pnpm run typecheck:libs` first. This triggers `tsc --build` on the composite lib packages and regenerates declarations. Then re-run the leaf typecheck.
