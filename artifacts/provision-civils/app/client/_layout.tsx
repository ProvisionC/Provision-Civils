import { Stack } from "expo-router";
import React from "react";
import { useColors } from "@/hooks/useColors";

export default function ClientLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontFamily: "Inter_600SemiBold", color: colors.foreground },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="create" options={{ title: "New Client" }} />
      <Stack.Screen name="[id]" options={{ title: "Edit Client" }} />
    </Stack>
  );
}
