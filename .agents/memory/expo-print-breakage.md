---
name: expo-print breakage
description: expo-print@15.0.8 crashes Metro bundler with ENOENT on a tmp android path; use Share API instead.
---

**Rule:** Do not install expo-print or expo-sharing in the provision-civils Expo app.

**Why:** expo-print@15.0.8 (the version compatible with Expo SDK 54) crashes Metro on startup with `ENOENT: no such file or directory, watch .../expo-print_tmp_1234/android/src/main`. The tmp path doesn't exist and Metro's FallbackWatcher throws immediately.

**How to apply:** For invoice sharing/export, use React Native's built-in `Share.share({ message: textContent })`. For any future PDF need, evaluate a JS-only PDF library (e.g. `react-native-html-to-pdf` or server-side generation) rather than expo-print.
