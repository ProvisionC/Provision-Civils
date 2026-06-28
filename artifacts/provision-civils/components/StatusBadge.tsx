import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Status = "pending" | "in_progress" | "waiting_for_materials" | "completed" | "cancelled";

const STATUS_COLORS: Record<Status, { bg: string; text: string; label: string }> = {
  pending: { bg: "#EEF1F8", text: "#64748B", label: "Pending" },
  in_progress: { bg: "#E3F2FD", text: "#1565C0", label: "In Progress" },
  waiting_for_materials: { bg: "#FFF3E0", text: "#E65100", label: "Waiting" },
  completed: { bg: "#E8F5E9", text: "#2E7D32", label: "Completed" },
  cancelled: { bg: "#FFEBEE", text: "#C62828", label: "Cancelled" },
};

interface StatusBadgeProps {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const cfg = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, size === "sm" && styles.sm]}>
      <Text style={[styles.text, { color: cfg.text }, size === "sm" && styles.smText]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smText: {
    fontSize: 11,
  },
});
