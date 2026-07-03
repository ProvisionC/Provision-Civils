import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListUserActivity } from "@workspace/api-client-react";

type UserActivity = {
  userId: number;
  userName: string;
  userRole: string;
  isOnline: boolean;
  lastSeenAt: string;
  platform?: string | null;
  appVersion?: string | null;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isActiveToday(lastSeenAt: string): boolean {
  const now = new Date();
  const last = new Date(lastSeenAt);
  return now.toDateString() === last.toDateString();
}

const ROLE_COLOR: Record<string, string> = {
  admin: "#1565C0",
  project_manager: "#7C3AED",
  supervisor: "#FF6F00",
  worker: "#64748B",
};

function ActivityItem({ item }: { item: UserActivity }) {
  const colors = useColors();
  const roleColor = ROLE_COLOR[item.userRole] ?? colors.mutedForeground;
  const initials = item.userName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const activeToday = isActiveToday(item.lastSeenAt);

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: roleColor + "20" }]}>
        <Text style={[styles.avatarText, { color: roleColor }]}>{initials}</Text>
        <View style={[styles.onlineDot, {
          backgroundColor: item.isOnline ? colors.success : colors.mutedForeground,
        }]} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.userName}</Text>
        <View style={styles.metaRow}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + "15" }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{item.userRole.replace("_", " ").toUpperCase()}</Text>
          </View>
          {item.platform && (
            <View style={styles.metaItem}>
              <Feather name={item.platform === "ios" ? "smartphone" : "tablet"} size={10} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.platform.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Status */}
      <View style={styles.statusCol}>
        <Text style={[styles.statusLabel, { color: item.isOnline ? colors.success : colors.mutedForeground }]}>
          {item.isOnline ? "● Online" : timeAgo(item.lastSeenAt)}
        </Text>
        {!item.isOnline && activeToday && (
          <Text style={[styles.todayLabel, { color: colors.warning }]}>Active today</Text>
        )}
      </View>
    </View>
  );
}

export default function UserActivityScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: activity = [], isLoading, refetch } = useListUserActivity({
    query: { queryKey: ["user-activity"], refetchInterval: 15000 },
  });

  const users = activity as UserActivity[];
  const onlineCount = users.filter(u => u.isOnline).length;
  const todayCount = users.filter(u => isActiveToday(u.lastSeenAt)).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>User Activity</Text>
        <TouchableOpacity onPress={() => refetch()} style={{ padding: 4 }}>
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <View style={[styles.summaryRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.success }]}>{onlineCount}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Online Now</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{todayCount}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Active Today</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{users.length}</Text>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Users</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={i => String(i.userId)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => <ActivityItem item={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activity recorded yet</Text>
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
  summaryRow: { flexDirection: "row", borderBottomWidth: 1, paddingVertical: 14 },
  summaryCard: { flex: 1, alignItems: "center", gap: 2 },
  summaryValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  divider: { width: 1, marginVertical: 4 },
  item: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", position: "relative" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  onlineDot: { width: 12, height: 12, borderRadius: 6, position: "absolute", bottom: 0, right: 0, borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  statusCol: { alignItems: "flex-end", gap: 2 },
  statusLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  todayLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
