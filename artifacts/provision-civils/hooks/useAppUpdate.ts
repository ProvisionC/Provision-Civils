import { useEffect, useRef, useCallback, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "ota-ready"        // OTA bundle downloaded, needs restart
  | "update-available" // Optional native update available
  | "force-update"     // Native version too old — must update
  | "error";

export interface ServerVersion {
  version: string;
  minimumVersion: string;
  buildDate: string;
  releaseNotes: string;
  downloadUrl: string | null;
}

function compareSemver(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

const LOCAL_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";

// Only use expo-updates on native non-development builds
const CAN_USE_OTA = !__DEV__ && Platform.OS !== "web";

async function fetchServerVersion(): Promise<ServerVersion> {
  return customFetch<ServerVersion>("/api/version", { responseType: "json" });
}

export function useAppUpdate() {
  const appState = useRef(AppState.currentState);
  const [otaReady, setOtaReady] = useState(false);

  // ── Fetch server version ──────────────────────────────────────────────────
  const { data: serverVersion, status, refetch } = useQuery<ServerVersion>({
    queryKey: ["app-version"],
    queryFn: fetchServerVersion,
    staleTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: 3000,
  });

  // ── Check for OTA update imperatively on mount (native prod only) ─────────
  useEffect(() => {
    if (!CAN_USE_OTA) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          setOtaReady(true);
        }
      } catch { /* silently ignore — EAS not configured or no network */ }
    })();
  }, []);

  // ── Refetch server version when app comes to foreground ───────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        refetch();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [refetch]);

  // ── Derive update status ──────────────────────────────────────────────────
  let updateStatus: UpdateStatus = "idle";
  if (status === "pending") {
    updateStatus = "checking";
  } else if (otaReady) {
    updateStatus = "ota-ready";
  } else if (serverVersion) {
    if (compareSemver(LOCAL_VERSION, serverVersion.minimumVersion) < 0) {
      updateStatus = "force-update";
    } else if (compareSemver(LOCAL_VERSION, serverVersion.version) < 0) {
      updateStatus = "update-available";
    } else {
      updateStatus = "up-to-date";
    }
  } else if (status === "error") {
    updateStatus = "error";
  }

  const applyOtaUpdate = useCallback(async () => {
    if (!CAN_USE_OTA) return;
    try { await Updates.reloadAsync(); } catch { /* ignore */ }
  }, []);

  const checkForUpdates = useCallback(async () => {
    await refetch();
    if (!CAN_USE_OTA) return;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setOtaReady(true);
      }
    } catch { /* silently ignore */ }
  }, [refetch]);

  return {
    updateStatus,
    localVersion: LOCAL_VERSION,
    serverVersion,
    isForceUpdate: updateStatus === "force-update",
    isOtaReady: otaReady,
    isUpdateAvailable: updateStatus === "update-available" || otaReady,
    applyOtaUpdate,
    checkForUpdates,
    isChecking: status === "pending",
  };
}
