import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListAuditLogs } from "@workspace/api-client-react";

const ACTION_COLORS: Record<string, string> = {
  Login: "#22C55E",
  Logout: "#94A3B8",
  "Created Job": "#1565C0",
  "Edited Job": "#FF6F00",
  "Deleted Job": "#D32F2F",
  "Updated Company Settings": "#7C3AED",
  "Triggered Manual Backup": "#0891B2",
  "Restored Database Backup": "#059669",
  "Restored job": "#059669",
  "Restored client": "#059669",
  "Restored employee": "#059669",
  "Permanently deleted job": "#D32F2F",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "#64748B";
}

type AuditLog = {
  id: number;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: number | null;
  description?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

function LogItem({ item }: { item: AuditLog }) {
  const colors = useColors();
  const actionColor = getActionColor(item.action);
  const dt = new Date(item.createdAt);

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: actionColor }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.itemTop}>
          <Text style={[styles.action, { color: colors.foreground }]}>{item.action}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        {item.description && (
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{item.description}</Text>
        )}
        <View style={styles.meta}>
          {item.userName && (
            <View style={styles.metaItem}>
              <Feather name="user" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.userName}</Text>
            </View>
          )}
          {item.userRole && (
            <View style={styles.metaItem}>
              <Feather name="shield" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.userRole}</Text>
            </View>
          )}
          {item.entityType && (
            <View style={styles.metaItem}>
              <Feather name="tag" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.entityType}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function AuditLogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useListAuditLogs(
    { limit: 200 },
    { query: { queryKey: ["audit-logs"], refetchInterval: 30000 } }
  );

  const logs = (data?.data ?? []) as AuditLog[];
  const filtered = search.trim()
    ? logs.filter(l =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        (l.userName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (l.description ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Audit Log</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{data?.total ?? 0}</Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search actions, users..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => <LogItem item={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="list" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No audit logs yet</Text>
            </View>
          }
          onRefresh={refetch}
          refreshing={isLoading}
        />
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
  count: { fontSize: 13, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  item: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, flexDirection: "row", gap: 12 },
  dot: { width: 4, borderRadius: 2, alignSelf: "stretch", marginTop: 4 },
  itemTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  action: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 8 },
  description: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 6 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
