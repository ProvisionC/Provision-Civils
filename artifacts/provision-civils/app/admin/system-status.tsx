import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useGetSystemStatus } from "@workspace/api-client-react";
import Constants from "expo-constants";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: ok ? colors.success + "20" : colors.destructive + "20" }]}>
        <Feather name={ok ? "check-circle" : "x-circle"} size={18} color={ok ? colors.success : colors.destructive} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: ok ? colors.success + "20" : colors.destructive + "20" }]}>
        <Text style={[styles.badgeText, { color: ok ? colors.success : colors.destructive }]}>{ok ? "Online" : "Offline"}</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.primary + "20" }]}>
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
    </View>
  );
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function SystemStatusScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: status, isLoading, refetch, isFetching } = useGetSystemStatus({
    query: { queryKey: ["system-status"], refetchInterval: 30000 },
  });

  const overallOk = status ? status.api && status.database : false;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>System Status</Text>
        <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn} disabled={isFetching}>
          {isFetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={20} color={colors.primary} />}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {/* Overall badge */}
          <View style={[styles.overallBadge, { backgroundColor: overallOk ? colors.success + "20" : colors.destructive + "20" }]}>
            <Feather name={overallOk ? "shield" : "alert-triangle"} size={20} color={overallOk ? colors.success : colors.destructive} />
            <Text style={[styles.overallText, { color: overallOk ? colors.success : colors.destructive }]}>
              {overallOk ? "All Systems Operational" : "System Issue Detected"}
            </Text>
          </View>

          {/* Services */}
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SERVICES</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <StatusRow label="API Server" value={status?.api ? "Responding normally" : "Not responding"} ok={status?.api ?? false} />
            <StatusRow label="Database" value={status?.database ? "Connected" : "Connection failed"} ok={status?.database ?? false} />
            <StatusRow label="Storage" value={status?.storage ? "Available" : "Unavailable"} ok={status?.storage ?? false} />
            <StatusRow label="Push Notifications" value={status?.pushNotifications ? "Active" : "Disabled"} ok={status?.pushNotifications ?? false} />
          </View>

          {/* Info */}
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>INFORMATION</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <InfoRow label="App Version" value={`v${APP_VERSION} (client)`} icon="smartphone" />
            <InfoRow label="Server Version" value={`v${status?.appVersion ?? "—"}`} icon="server" />
            <InfoRow label="Server Uptime" value={status?.uptime ? formatUptime(status.uptime) : "—"} icon="clock" />
            <InfoRow label="Last Backup" value={status?.lastBackupAt ? new Date(status.lastBackupAt).toLocaleString() : "No backup yet"} icon="database" />
            <InfoRow label="Last Check" value={status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "—"} icon="activity" />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  refreshBtn: { padding: 4 },
  overallBadge: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, marginBottom: 16 },
  overallText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
