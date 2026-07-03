---
name: expo-local-authentication SDK 54 version
description: Correct version of expo-local-authentication for Expo SDK 54; v57 causes immediate native crash on Android.
---

# expo-local-authentication version for Expo SDK 54

**Rule:** Use `~17.0.8` — not `^57.0.0` (or any v57.x.x).

**Why:** Version 57 of expo-local-authentication is incompatible with the Expo SDK 54 native runtime. Installing v57 causes an immediate "keeps stopping" native crash on Android on launch. The crash is silent — no JavaScript error boundary catches it.

**How to apply:** Always verify against SDK 54's `bundledNativeModules.json`:
```
https://raw.githubusercontent.com/expo/expo/sdk-54/packages/expo/bundledNativeModules.json
```
Run `pnpm install` after correcting the version — the lockfile will show the downgrade clearly (e.g. `expo-local-authentication 57.0.0 → 17.0.8`).

**Confirmed correct versions for Expo SDK 54:**
- expo-local-authentication: ~17.0.8
- expo-av: ~16.0.8
- expo-blur: ~15.0.8
- expo-haptics: ~15.0.8
- expo-image-picker: ~17.0.11
- expo-location: ~19.0.8
- expo-document-picker: ~14.0.8
- expo-file-system: ~19.0.23
- expo-sharing: ~14.0.8
- expo-updates: ~29.0.18
