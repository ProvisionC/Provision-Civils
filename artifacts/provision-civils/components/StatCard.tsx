import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, color, icon }: StatCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: color ?? colors.primary }]}>
      <View style={styles.row}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.content}>
          <Text style={[styles.value, { color: color ?? colors.primary }]}>{value}</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: 140,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {},
  content: {
    flex: 1,
  },
  value: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
});
