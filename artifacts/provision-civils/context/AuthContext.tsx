import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, type AppStateStatus } from "react-native";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import * as LocalAuthentication from "expo-local-authentication";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { router } from "expo-router";

// Local development API
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
const API_DOMAIN = "https://provision-api-ckpk.onrender.com";

const API_URL = API_DOMAIN.startsWith("http")
  ? API_DOMAIN
  : API_DOMAIN.includes(":")
    ? `http://${API_DOMAIN}`
    : `https://${API_DOMAIN}`;

setBaseUrl(API_URL);

const INACTIVITY_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const BIOMETRIC_KEY = "biometric_enabled";
const LAST_ACTIVE_KEY = "last_active_at";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "project_manager" | "supervisor" | "worker";
  phone: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  recordActivity: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Check biometric hardware support
  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);

        const enabled = await AsyncStorage.getItem(BIOMETRIC_KEY);
        setBiometricEnabled(enabled === "true");
      } catch { /* biometrics not supported */ }
    })();
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem("auth_token");
        const storedUser = await AsyncStorage.getItem("auth_user");
        const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

        if (storedToken && storedUser) {
          // Check if session expired due to inactivity
          if (lastActiveStr) {
            const lastActive = parseInt(lastActiveStr, 10);
            if (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
              // Session timed out — clear it
              await clearSession();
              return;
            }
          }
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as AuthUser);
          setAuthTokenGetter(() => storedToken);
          resetInactivityTimer();
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // AppState change — detect coming back from background
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState: AppStateStatus) => {
      if (nextState === "active" && appStateRef.current !== "active") {
        // App came back to foreground — check inactivity
        const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);
        if (lastActiveStr && token) {
          const lastActive = parseInt(lastActiveStr, 10);
          if (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
            await doLogout();
            return;
          }
        }
        recordActivity();
      }
      if (nextState === "background" || nextState === "inactive") {
        await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [token]);

  const clearSession = async () => {
  console.log("CLEAR SESSION");
    await AsyncStorage.multiRemove(["auth_token", "auth_user", LAST_ACTIVE_KEY]);
    setToken(null);
    setUser(null);
    setAuthTokenGetter(() => null);
  };

  const doLogout = useCallback(async () => {
  console.trace("DO LOGOUT");
    if (inactivityTimer.current) clearInterval(inactivityTimer.current as any);
    await clearSession();
    try { router.replace("/(auth)/login"); } catch { /* may not be mounted */ }
  }, []);

  const resetInactivityTimer = useCallback(() => {
  if (inactivityTimer.current) clearInterval(inactivityTimer.current as any);

  // Check every minute instead of waiting 30 days.
  inactivityTimer.current = setInterval(async () => {
    const lastActiveStr = await AsyncStorage.getItem(LAST_ACTIVE_KEY);

    if (!lastActiveStr) return;

    const lastActive = parseInt(lastActiveStr, 10);

    if (Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
      await doLogout();
    }
  }, 60000) as any;
}, [doLogout]);

  const recordActivity = useCallback(() => {
    AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString()).catch(() => {});
    if (token) resetInactivityTimer();
  }, [token, resetInactivityTimer]);

async function registerPushNotification(token: string) {
  console.log("REGISTER FUNCTION CALLED");
  try {
    if (!Device.isDevice) {
      console.log("Push notifications require a physical device");
      return;
    }

    const permission = await Notifications.getPermissionsAsync();

    let status = permission.status;

    if (status !== "granted") {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }

    if (status !== "granted") {
      console.log("Notification permission denied");
      return;
    }

    console.log("REGISTER PUSH START");

console.log("GETTING EXPO TOKEN");
const expoToken = await Notifications.getExpoPushTokenAsync({
  projectId: "a6093da0-719f-4eee-86e4-a87d0059c219",
});

console.log("Expo Push Token:", expoToken.data);

console.log("SENDING TOKEN TO API");

const response = await fetch(`${API_URL}/push-tokens`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    token: expoToken.data,
    platform: "expo",
  }),
});

console.log("API STATUS:", response.status);

const responseText = await response.text();
console.log("API RESPONSE:", responseText);

if (!response.ok) {
  throw new Error(`Push registration failed: ${response.status} ${responseText}`);
}

console.log("Push token registered");

} catch (error) {
  console.error("Push registration failed:", error);
}
}

const login = async (newToken: string, newUser: AuthUser) => {
  console.log("LOGIN START");

  await AsyncStorage.setItem("auth_token", newToken);
  await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
  await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());

  setToken(newToken);
  setUser(newUser);
  setAuthTokenGetter(() => newToken);
  resetInactivityTimer();

  console.log("BEFORE REGISTER");

  await registerPushNotification(newToken);

  console.log("AFTER REGISTER");
};

  const logout = async () => {
    if (inactivityTimer.current) clearInterval(inactivityTimer.current as any);
    await clearSession();
  };

  const enableBiometric = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm your identity to enable biometric login",
        fallbackLabel: "Use Password",
      });
      if (result.success) {
        await AsyncStorage.setItem(BIOMETRIC_KEY, "true");
        setBiometricEnabled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const disableBiometric = async () => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, "false");
    setBiometricEnabled(false);
  };

const loginWithBiometric = async (): Promise<boolean> => {
    try {
      const storedToken = await AsyncStorage.getItem("auth_token");
      const storedUser = await AsyncStorage.getItem("auth_user");
      if (!storedToken || !storedUser) return false;
const result = await LocalAuthentication.authenticateAsync({
  promptMessage: "Sign in to Provision Civils",
  fallbackLabel: "Use Password",
});
      if (result.success) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as AuthUser);
        setAuthTokenGetter(() => storedToken);
        await AsyncStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
        resetInactivityTimer();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };
useEffect(() => {
  const received = Notifications.addNotificationReceivedListener(notification => {
    console.log("Notification received:", notification);
  });

  const response = Notifications.addNotificationResponseReceivedListener(response => {
    console.log("Notification opened:", response);
  });

  return () => {
    received.remove();
    response.remove();
  };
}, []);
  return (
    <AuthContext.Provider value={{
      user, token, isLoading,
      biometricAvailable, biometricEnabled,
      login, logout,
      enableBiometric, disableBiometric, loginWithBiometric,
      recordActivity,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
