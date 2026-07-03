import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  Platform, RefreshControl, Animated, Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  getListNotificationsQueryKey,
} from "@workspace/api-client-react";

type NotifType = string;

const ICON_MAP: Record<string, { name: string; color: string }> = {
  job_assigned:           { name: "briefcase",    color: "#2563EB" },
  job_updated:            { name: "edit-2",       color: "#F97316" },
  job_completed:          { name: "check-circle", color: "#16A34A" },
  job_completed_project:  { name: "check-circle", color: "#16A34A" },
  invoice_created:        { name: "file-text",    color: "#7C3AED" },
  invoice_ready:          { name: "file-text",    color: "#7C3AED" },
  daily_report_submitted: { name: "clipboard",    color: "#0891B2" },
  photos_uploaded:        { name: "camera",       color: "#0891B2" },
  photos_not_uploaded:    { name: "camera-off",   color: "#DC2626" },
  labour_submitted:       { name: "users",        color: "#0891B2" },
  expense_added:          { name: "credit-card",  color: "#D97706" },
  payroll_ready:          { name: "dollar-sign",  color: "#16A34A" },
  employee_paid:          { name: "check-circle", color: "#16A34A" },
  new_client:             { name: "user-plus",    color: "#7C3AED" },
  job_overdue:            { name: "alert-triangle", color: "#DC2626" },
  job_due_today:          { name: "clock",        color: "#D97706" },
  progress_milestone:     { name: "trending-up",  color: "#0891B2" },
  material_low:           { name: "package",      color: "#D97706" },
  po_uploaded:            { name: "upload",       color: "#0891B2" },
  variation_added:        { name: "git-branch",   color: "#7C3AED" },
  completion_outstanding: { name: "alert-circle", color: "#DC2626" },
  wayleave_outstanding:   { name: "alert-circle", color: "#DC2626" },
  report_reminder:        { name: "clock",        color: "#D97706" },
  new_message:            { name: "message-circle", color: "#2563EB" },
  app_update:             { name: "download",     color: "#0891B2" },
  server_offline:         { name: "wifi-off",     color: "#DC2626" },
  backup_completed:       { name: "save",         color: "#16A34A" },
};

function getIcon(type: NotifType) {
  return ICON_MAP[type] ?? { name: "bell", color: "#6B7280" };
}

function groupByDate(notifications: any[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const todayStr = today.toDateString();
  const yestStr = yesterday.toDateString();

  const groups: { title: string; data: any[] }[] = [
    { title: "Today", data: [] },
    { title: "Yesterday", data: [] },
    { title: "Older", data: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt).toDateString();
    if (d === todayStr) groups[0].data.push(n);
    else if (d === yestStr) groups[1].data.push(n);
    else groups[2].data.push(n);
  }

  return groups.filter(g => g.data.length > 0);
}

function handleNavigation(n: any) {
  if (n.type === "new_message" && n.referenceId) {
    router.push(`/messages/${n.referenceId}` as any);
  } else if (n.jobId) {
    router.push(`/job/${n.jobId}` as any);
  } else if (n.referenceType === "invoice" && n.referenceId) {
    router.push(`/invoice/${n.referenceId}` as any);
  }
}

function NotificationRow({ item, onPress, colors }: { item: any; onPress: () => void; colors: any }) {
  const icon = getIcon(item.type);
  const time = new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.row,
        {
          backgroundColor: item.read ? colors.card : colors.primary + "10",
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: icon.color + "18" }]}>
        <Feather name={icon.name as any} size={18} color={icon.color} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowMsg, { color: colors.foreground }]} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>{time}</Text>
      </View>
      {!item.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: notifications, isLoading, refetch } = useListNotifications();
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    },
  });
  const markAll = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
      onError: () => Alert.alert("Error", "Failed to mark all as read"),
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const unread = notifications?.filter(n => !n.read).length ?? 0;
  const sections = useMemo(() => groupByDate(notifications ?? []), [notifications]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
        {unread > 0 && (
          <TouchableOpacity
            onPress={() => markAll.mutate()}
            style={[styles.markAllBtn, { borderColor: colors.border }]}
          >
            <Feather name="check-circle" size={14} color={colors.primary} />
            <Text style={[styles.markAllText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{section.title}</Text>
        )}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="bell-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "All caught up!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            colors={colors}
            onPress={() => {
              if (!item.read) markRead.mutate({ id: item.id });
              handleNavigation(item);
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, alignSelf: "flex-start" },
  markAllText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  sectionHeader: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowMsg: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  rowTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 60, borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed" },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
