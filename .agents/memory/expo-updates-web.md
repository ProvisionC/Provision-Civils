---
name: expo-updates hook on web
description: expo-updates useUpdates() hook crashes the app on web/development; use imperative API instead with a platform guard.
---

## Rule
Never call `Updates.useUpdates()` (the React hook) in components that render on web or in development. Use the imperative `Updates.checkForUpdateAsync()` / `Updates.fetchUpdateAsync()` / `Updates.reloadAsync()` inside `useEffect` / callbacks instead.

**Why:** On web and in Expo Go (development), `useUpdates()` throws before the function body can handle it. Even wrapping in try-catch doesn't help when React Compiler is enabled — the thrown exception corrupts the hook call order and causes a downstream `Cannot read properties of undefined` crash.

**How to apply:**
```ts
const CAN_USE_OTA = !__DEV__ && Platform.OS !== "web";

// In useEffect:
useEffect(() => {
  if (!CAN_USE_OTA) return;
  (async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setOtaReady(true);
      }
    } catch { /* silently ignore */ }
  })();
}, []);
```

Also guard `Updates.reloadAsync()` with `if (!CAN_USE_OTA)` before calling.

Track OTA state with `useState<boolean>` in the hook rather than reading it from `useUpdates()`.
