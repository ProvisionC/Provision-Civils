import React, { useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListEmployees, useListTeams, useListJobs,
  useCreateConversation, useGetOrCreateJobChat,
} from "@workspace/api-client-react";

type Props = { onClose: () => void; onCreated: (id: number) => void };

type Tab = "direct" | "job" | "team";

export default function NewConversationModal({ onClose, onCreated }: Props) {
  const colors = useColors();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("direct");
  const [search, setSearch] = useState("");

  const { data: employees } = useListEmployees();
  const { data: teams } = useListTeams();
  const { data: jobs } = useListJobs();
  const createConvo = useCreateConversation();
  const getJobChat = useGetOrCreateJobChat();

  const isAdmin = user?.role === "admin" || user?.role === "project_manager";

  const filteredEmployees = (employees ?? []).filter(e =>
    e.id !== user?.id && e.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTeams = (teams ?? []).filter((t: any) =>
    t.name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredJobs = (jobs ?? []).filter((j: any) =>
    (j.clientName + (j.projectName ?? "")).toLowerCase().includes(search.toLowerCase())
  );

  async function startDirect(userId: number) {
    const res = await createConvo.mutateAsync({
      data: { type: "direct", memberIds: [userId] },
    });
    onCreated((res as any).id);
  }

  async function startJobChat(jobId: number) {
    const res = await getJobChat.mutateAsync({ jobId });
    onCreated((res as any).id);
  }

  async function startTeamChat(team: any) {
    const res = await createConvo.mutateAsync({
      data: { type: "team_chat", name: team.name, teamId: team.id, memberIds: (team.members ?? []).map((m: any) => m.userId) },
    });
    onCreated((res as any).id);
  }

  const isLoading = createConvo.isPending || getJobChat.isPending;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Conversation</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={[styles.tabs, { borderColor: colors.border }]}>
            {(["direct", "job", "team"] as Tab[]).map(t => (
              <TouchableOpacity
                key={t}
                onPress={() => { setTab(t); setSearch(""); }}
                style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              >
                <Text style={[styles.tabLabel, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
                  {t === "direct" ? "Direct" : t === "job" ? "Job Chat" : "Team Chat"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={tab === "direct" ? "Search employees..." : tab === "job" ? "Search jobs..." : "Search teams..."}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
            />
          </View>

          {tab === "direct" && (
            <FlatList
              data={filteredEmployees}
              keyExtractor={e => String(e.id)}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => startDirect(item.id)}
                  disabled={isLoading}
                  style={[styles.listItem, { borderColor: colors.border }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="user" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.listBody}>
                    <Text style={[styles.listName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{item.role?.replace("_", " ")}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>No employees found</Text>}
            />
          )}

          {tab === "job" && (
            <FlatList
              data={filteredJobs}
              keyExtractor={(j: any) => String(j.id)}
              style={styles.list}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  onPress={() => startJobChat(item.id)}
                  disabled={isLoading}
                  style={[styles.listItem, { borderColor: colors.border }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="briefcase" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.listBody}>
                    <Text style={[styles.listName, { color: colors.foreground }]}>{item.clientName}</Text>
                    {item.projectName && <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{item.projectName}</Text>}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>No jobs found</Text>}
            />
          )}

          {tab === "team" && (
            <FlatList
              data={filteredTeams}
              keyExtractor={(t: any) => String(t.id)}
              style={styles.list}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  onPress={() => startTeamChat(item)}
                  disabled={isLoading}
                  style={[styles.listItem, { borderColor: colors.border }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="users" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.listBody}>
                    <Text style={[styles.listName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.listSub, { color: colors.mutedForeground }]}>{item.members?.length ?? 0} members</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyTeam}>
                  <Text style={[styles.emptyLabel, { color: colors.mutedForeground }]}>No teams yet</Text>
                  {isAdmin && (
                    <Text style={[styles.emptyLabel, { color: colors.mutedForeground, fontSize: 12 }]}>
                      Create teams in Settings → Teams
                    </Text>
                  )}
                </View>
              }
            />
          )}

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "80%", paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginVertical: 10, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  list: { maxHeight: 360 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  listBody: { flex: 1 },
  listName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  listSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  emptyLabel: { textAlign: "center", paddingVertical: 24, fontFamily: "Inter_400Regular" },
  emptyTeam: { alignItems: "center" },
  loadingOverlay: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#00000020" },
});
