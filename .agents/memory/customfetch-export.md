---
name: customFetch export from api-client-react
description: customFetch must be explicitly re-exported from lib/api-client-react/src/index.ts.
---

## Rule

`customFetch` from `lib/api-client-react/src/custom-fetch.ts` is NOT auto-included via `export * from "./generated/api"`. It must be listed explicitly in `lib/api-client-react/src/index.ts`:

```ts
export { setBaseUrl, setAuthTokenGetter, customFetch } from "./custom-fetch";
```

**Why:** `export *` only covers the generated barrel; the custom-fetch utilities are hand-written helpers that must be opted in manually.

**How to apply:** When any screen needs to call an API endpoint not covered by generated hooks (e.g. a new route added directly to the Express router without going through OpenAPI codegen), import `customFetch` from `@workspace/api-client-react`. It automatically handles the base URL (set by `setBaseUrl`) and injects the Bearer token (set by `setAuthTokenGetter`), so no manual auth header or base URL construction is needed.
