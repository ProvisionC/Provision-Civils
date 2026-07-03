import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { sendHeartbeat } from "@workspace/api-client-react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";
const HEARTBEAT_INTERVAL = 60 * 1000; // 1 minute

export function useHeartbeat() {
  const { token } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const beat = async () => {
    if (!token) return;
    try {
      await sendHeartbeat({
        platform: Platform.OS,
        appVersion: APP_VERSION,
        deviceInfo: `${Platform.OS} ${Platform.Version}`,
      });
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    if (!token) return;

    beat();
    intervalRef.current = setInterval(beat, HEARTBEAT_INTERVAL);

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") beat();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [token]);
}
