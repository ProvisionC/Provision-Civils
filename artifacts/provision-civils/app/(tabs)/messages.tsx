import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, RefreshControl, TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useListConversations, getListConversationsQueryKey, useGetOrCreateJobChat, useCreateConversation } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import NewConversationModal from "@/components/messaging/NewConversationModal";

type Convo = {
  id: number;
  type: string;
  name: string | null;
  jobId: number | null;
  teamId: number | null;
  createdAt: string;
  members: { userId: number; name: string }[];
  lastMessage: { id: number; type: string; content: string; senderId: number | null; createdAt: string } | null;
  unreadCount: number;
};

function getConvoLabel(c: Convo, myUserId: number) {
  if (c.type === "direct") {
    const other = c.members.find(m => m.userId !== myUserId);
    return other?.name ?? "Direct Message";
  }
  return c.name ?? (c.type === "job_chat" ? "Job Chat" : "Team Chat");
}

function getConvoIcon(type: string) {
  if (type === "direct") return "user";
  if (type === "job_chat") return "briefcase";
  return "users";
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

function ConversationItem({ convo, myUserId, colors, onPress }: { convo: Convo; myUserId: number; colors: any; onPress: () => void }) {
  const label = getConvoLabel(convo, myUserId);
  const icon = getConvoIcon(convo.type);
  const hasUnread = convo.unreadCount > 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.convItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <View style={styles.convBody}>
        <View style={styles.convTopRow}>
          <Text style={[styles.convName, { color: colors.foreground, fontFamily: hasUnread ? "Inter_700Bold" : "Inter_500Medium" }]} numberOfLines={1}>{label}</Text>
          {convo.lastMessage && (
            <Text style={[styles.convTime, { color: colors.mutedForeground }]}>{formatTime(convo.lastMessage.createdAt)}</Text>
          )}
        </View>
        {convo.lastMessage && (
          <Text style={[styles.convPreview, { color: hasUnread ? colors.foreground : colors.mutedForeground, fontFamily: hasUnread ? "Inter_500Medium" : "Inter_400Regular" }]} numberOfLines={1}>
            {convo.lastMessage.content}
          </Text>
        )}
      </View>
      {hasUnread && (
        <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.unreadText}>{convo.unreadCount > 99 ? "99+" : convo.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: conversations, isLoading, refetch } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 5000 },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const sorted = useMemo(() => {
    const all = (conversations ?? []) as Convo[];
    const filtered = search.trim()
      ? all.filter(c => {
          const label = getConvoLabel(c, user?.id ?? 0).toLowerCase();
          return label.includes(search.toLowerCase());
        })
      : all;
    return [...filtered].sort((a, b) => {
      const aTime = a.lastMessage?.createdAt ?? a.createdAt;
      const bTime = b.lastMessage?.createdAt ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [conversations, search, user?.id]);

  const direct = sorted.filter(c => c.type === "direct");
  const jobChats = sorted.filter(c => c.type === "job_chat");
  const teamChats = sorted.filter(c => c.type === "team_chat");

  const sections = [
    { title: "Direct Messages", icon: "user", data: direct },
    { title: "Job Chats", icon: "briefcase", data: jobChats },
    { title: "Team Chats", icon: "users", data: teamChats },
  ].filter(s => s.data.length > 0 || !search);

  const allFiltered = search.trim() ? sorted : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Messages</Text>
          <TouchableOpacity onPress={() => setShowNew(true)} style={[styles.newBtn, { backgroundColor: colors.primary }]}>
            <Feather name="edit" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={[styles.searchBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search messages..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {allFiltered !== null ? (
        <FlatList
          data={allFiltered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
          renderItem={({ item }) => (
            <ConversationItem
              convo={item}
              myUserId={user?.id ?? 0}
              colors={colors}
              onPress={() => router.push(`/messages/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <View style={[styles.empty, { borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No results</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={s => s.title}
          contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            isLoading ? (
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading...</Text>
              </View>
            ) : (
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Feather name="message-circle" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No conversations yet</Text>
                <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tap the edit icon to start a conversation</Text>
              </View>
            )
          }
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name={section.icon as any} size={14} color={colors.mutedForeground} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
              </View>
              {section.data.length === 0 ? (
                <View style={[styles.emptySection, { borderColor: colors.border }]}>
                  <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>No {section.title.toLowerCase()} yet</Text>
                </View>
              ) : (
                section.data.map(convo => (
                  <ConversationItem
                    key={convo.id}
                    convo={convo}
                    myUserId={user?.id ?? 0}
                    colors={colors}
                    onPress={() => router.push(`/messages/${convo.id}` as any)}
                  />
                ))
              )}
            </View>
          )}
        />
      )}

      {showNew && (
        <NewConversationModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            router.push(`/messages/${id}` as any);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  newBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  list: { padding: 16 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },
  convItem: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  convBody: { flex: 1 },
  convTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  convName: { fontSize: 15, flex: 1, marginRight: 8 },
  convTime: { fontSize: 11 },
  convPreview: { fontSize: 13, marginTop: 2 },
  unreadBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: "center" },
  unreadText: { color: "#FFF", fontSize: 11, fontFamily: "Inter_700Bold" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 60, borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed" },
  emptySection: { paddingVertical: 16, borderWidth: 1, borderRadius: 10, alignItems: "center", borderStyle: "dashed" },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, textAlign: "center" },
});
