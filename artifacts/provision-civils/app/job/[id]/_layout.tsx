import { Stack } from "expo-router";
import React from "react";
import { useColors } from "@/hooks/useColors";

export default function JobSubLayout() {
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
      <Stack.Screen name="photos" options={{ title: "Photos" }} />
      <Stack.Screen name="materials" options={{ title: "Materials Checklist" }} />
      <Stack.Screen name="edit" options={{ title: "Edit Job" }} />
      <Stack.Screen name="reports" options={{ title: "Daily Reports" }} />
    </Stack>
  );
}
