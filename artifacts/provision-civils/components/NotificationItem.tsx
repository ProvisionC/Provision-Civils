import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Notification } from "@workspace/api-client-react";

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  job_assigned: { icon: "briefcase", color: "#1565C0" },
  job_updated: { icon: "edit", color: "#FF6F00" },
  job_completed: { icon: "check-circle", color: "#2E7D32" },
  invoice_created: { icon: "file-text", color: "#7B1FA2" },
};

interface NotificationItemProps {
  notification: Notification;
  onPress?: () => void;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const colors = useColors();
  const cfg = TYPE_ICONS[notification.type] ?? { icon: "bell", color: colors.primary };

  return (
    <TouchableOpacity
      style={[
        styles.item,
        { backgroundColor: notification.read ? colors.card : colors.primary + "08", borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: cfg.color + "15" }]}>
        <Feather name={cfg.icon as any} size={18} color={cfg.color} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {new Date(notification.createdAt).toLocaleString()}
        </Text>
      </View>
      {!notification.read && (
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  item: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
