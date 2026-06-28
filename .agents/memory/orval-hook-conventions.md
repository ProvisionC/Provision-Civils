---
name: Orval generated hook conventions
description: How Orval-generated hooks and plain fetch functions differ in argument shape for this project's API client.
---

**Rule:** List hooks take query params as the **first positional argument** (not wrapped in `{ params: ... }`). The plain fetch function `login()` takes the body directly; only the `useLogin` mutation hook wraps it in `{ data: body }`.

**Why:** Orval generates list hooks as `useListX(params?, options?)` where params is the first arg. The `login` plain function is `login(loginInput, options?)` — direct body. The `useLogin` mutation's mutate variable is `{data: LoginInput}` because Orval wraps mutation bodies in `{data}` for consistency with the mutation handler pattern.

**How to apply:**
- `useListJobs({ status: "pending" })` ✓ — not `useListJobs({ params: { status: "pending" } })`
- `await login({ email, password })` ✓ — not `await login({ data: { email, password } })`
- `useLogin` mutation: `mutate({ data: { email, password } })` ✓
- For options needing `queryKey`, import `getListXQueryKey()` and pass `{ query: { queryKey: getListXQueryKey(), enabled: ... } }`.
