import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";

export default function PayrollLayout() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="[employeeId]" />
    </Stack>
  );
}
