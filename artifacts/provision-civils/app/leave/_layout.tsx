import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";

export default function LeaveLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.foreground, headerTitleStyle: { fontFamily: "Inter_600SemiBold" } }}>
      <Stack.Screen name="index" options={{ title: "Leave" }} />
      <Stack.Screen name="create" options={{ title: "Request Leave", presentation: "modal" }} />
    </Stack>
  );
}
