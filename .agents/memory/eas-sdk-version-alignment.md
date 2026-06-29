---
name: EAS build SDK version alignment
description: expo-updates and some community packages (expo-speech-recognition) align major version to Expo SDK; installing latest will break native builds if wrong SDK.
---

## Rule
When adding ANY `expo-*` package via `pnpm add`, verify the version is SDK-compatible before triggering an EAS build. Do NOT blindly install `latest` for expo packages.

**Why:** expo-updates@56.x and expo-speech-recognition@56.x are built for Expo SDK 56 and use APIs (`OptimizedRecord`, `onDidCreateReactHost`) that don't exist in SDK 54's `expo-modules-core`, causing `compileReleaseKotlin FAILED` with `Unresolved reference` errors.

**How to apply:**
1. After `pnpm add expo-updates`, check `node_modules/expo/bundledNativeModules.json` — it maps package names to the exact compatible version range for the installed SDK.
2. For packages NOT in bundledNativeModules.json (community packages), check their npm version history: if they have a version number that matches the SDK major (e.g., 56.x for SDK 56), they use SDK version alignment and the correct version for SDK 54 would be 54.x or the last pre-56 release.
3. For this project (SDK 54): expo-updates → `~29.0.18`, expo-speech-recognition → `~3.1.3`.
4. Always use `npx expo install <package>` (or check bundledNativeModules.json) instead of plain `pnpm add` to avoid version mismatches.

## How to fetch EAS build logs programmatically
- `eas build:view BUILD_ID --json` returns a `logFiles[]` array with signed GCS URLs (valid 900s)
- The log file is NDJSON (one JSON object per line), NOT plain text or gzip
- Parse with: `log.split('\n').map(l => JSON.parse(l)).filter(j => j.phase === 'RUN_GRADLEW')`
- First real errors have `e:` prefix (Kotlin compile errors) or `Execution failed for task`
- REST API `GET /v2/builds/:id` returns 404 — use EAS CLI JSON output instead
