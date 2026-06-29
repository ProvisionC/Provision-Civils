import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";

export default function LabourLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.foreground, headerTitleStyle: { fontFamily: "Inter_600SemiBold" } }}>
      <Stack.Screen name="create" options={{ title: "Add Labour Entry", presentation: "modal" }} />
    </Stack>
  );
}
