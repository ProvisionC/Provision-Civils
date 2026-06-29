---
name: Expo Router nested routes need layout
description: Screens in app/job/[id]/ are silently unroutable without a _layout.tsx inside that directory.
---

## Rule

When you have both `app/job/[id].tsx` (the detail screen) AND a `app/job/[id]/` directory with nested screens (photos.tsx, edit.tsx, etc.), the nested screens are **not registered by Expo Router v6** unless `app/job/[id]/_layout.tsx` exists.

Without the layout file, `router.push('/job/123/photos')` silently does nothing — no error, no navigation.

**Why:** Expo Router requires a Stack (or other navigator) layout to register the routes inside any directory segment. A missing layout means no navigator = no routes.

**How to apply:** Any time you create a subdirectory under a dynamic segment (e.g. `[id]/`), immediately create `_layout.tsx` inside it with a Stack navigator. Configure screen options (header style, tintColor, etc.) and list `<Stack.Screen>` entries for each route with the correct title.
