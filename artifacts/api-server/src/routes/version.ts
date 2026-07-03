import { Router } from "express";

const router = Router();

// ── App version config ─────────────────────────────────────────────────────
// Bump `minimumVersion` to force all native installs below that version to
// download a new APK before they can continue using the app.
// Bump `current` whenever a new APK is distributed (even if minimum stays).
const VERSION_CONFIG = {
  version: "1.0.0",        // Latest published app version
  minimumVersion: "1.0.0", // Oldest allowed native version (bump to force-update)
  buildDate: "2026-07-03",
  releaseNotes: "Messaging reliability, photo upload queue, system status endpoint, bug fixes.",
  downloadUrl: process.env.APK_DOWNLOAD_URL ?? null,
};

// GET /api/version — public, no auth required
router.get("/version", (_req, res): void => {
  res.json(VERSION_CONFIG);
});

export default router;
