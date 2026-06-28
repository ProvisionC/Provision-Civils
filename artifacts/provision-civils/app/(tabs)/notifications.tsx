import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useListNotifications, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { NotificationItem } from "@/components/NotificationItem";

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: notifications, isLoading, refetch } = useListNotifications();
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      },
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const unread = notifications?.filter(n => !n.read).length ?? 0;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Alerts</Text>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{unread}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={notifications ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        scrollEnabled={!!(notifications && notifications.length > 0)}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="bell-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No notifications"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onPress={() => {
              if (!item.read) markRead.mutate({ id: item.id });
              if (item.jobId) router.push(`/job/${item.jobId}` as any);
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
  list: { padding: 16 },
  empty: {
    alignItems: "center", gap: 12, paddingVertical: 60,
    borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
