import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CrashReporter } from "@/components/CrashReporter";
import { AuthProvider } from "@/context/AuthContext";
import { PhotoUploadProvider } from "@/context/PhotoUploadContext";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UpdateModal } from "@/components/UpdateModal";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useHeartbeat } from "@/hooks/useHeartbeat";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function UpdateController() {
  const { isForceUpdate, isOtaReady, serverVersion, localVersion, applyOtaUpdate } = useAppUpdate();
  return (
    <>
      <UpdateBanner
        visible={isOtaReady}
        onApply={applyOtaUpdate}
        onDismiss={() => {}}
      />
      <UpdateModal
        visible={isForceUpdate}
        serverVersion={serverVersion}
        localVersion={localVersion}
      />
    </>
  );
}

function HeartbeatController() {
  useHeartbeat();
  return null;
}

function RootLayoutNav() {
  return (
    <>
      <UpdateController />
      <HeartbeatController />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job" options={{ headerShown: false }} />
        <Stack.Screen name="client" options={{ headerShown: false }} />
        <Stack.Screen name="invoice" options={{ headerShown: false }} />
        <Stack.Screen name="employee" options={{ headerShown: false }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="teams" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <CrashReporter>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <PhotoUploadProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </PhotoUploadProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </CrashReporter>
    </SafeAreaProvider>
  );
}
