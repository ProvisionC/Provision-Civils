import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}

export function StatCard({ label, value, color, icon, onPress }: StatCardProps) {
  const colors = useColors();
  const accent = color ?? colors.primary;

  const card = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: accent }]}>
      <View style={styles.row}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.content}>
          <Text style={[styles.value, { color: accent }]}>{value}</Text>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
        {!!onPress && (
          <Feather name="chevron-right" size={16} color={accent} />
        )}
      </View>
    </View>
  );

  if (!onPress) return card;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.72} style={styles.touchable}>
      {card}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { flex: 1 },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    flex: 1,
    minWidth: 140,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: {},
  content: { flex: 1 },
  value: { fontSize: 28, fontWeight: "700", fontFamily: "Inter_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
});
