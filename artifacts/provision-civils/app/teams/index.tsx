import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, RefreshControl, Alert, TextInput, Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam,
  useAddTeamMember, useRemoveTeamMember, useListEmployees,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";

type Team = {
  id: number;
  name: string;
  description: string | null;
  members: { userId: number; name: string; role: string }[];
};

export default function TeamsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isAdmin = user?.role === "admin" || user?.role === "project_manager";

  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: teams, refetch, isLoading } = useListTeams();
  const { data: employees } = useListEmployees();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditTeam(null);
    setTeamName("");
    setTeamDesc("");
    setSelectedMembers([]);
    setMemberSearch("");
    setShowCreate(true);
  };

  const openEdit = (team: Team) => {
    setEditTeam(team);
    setTeamName(team.name);
    setTeamDesc(team.description ?? "");
    setSelectedMembers(team.members.map(m => m.userId));
    setMemberSearch("");
    setShowCreate(true);
  };

  const saveTeam = async () => {
    if (!teamName.trim()) { Alert.alert("Error", "Team name is required"); return; }
    try {
      if (editTeam) {
        await updateTeam.mutateAsync({ id: editTeam.id, data: { name: teamName.trim(), description: teamDesc } });
        for (const m of editTeam.members) {
          if (!selectedMembers.includes(m.userId)) {
            await removeMember.mutateAsync({ id: editTeam.id, userId: m.userId }).catch(() => {});
          }
        }
        for (const uid of selectedMembers) {
          if (!editTeam.members.find(m => m.userId === uid)) {
            await addMember.mutateAsync({ id: editTeam.id, data: { userId: uid } }).catch(() => {});
          }
        }
      } else {
        await createTeam.mutateAsync({ data: { name: teamName.trim(), description: teamDesc, memberIds: selectedMembers } });
      }
      qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      setShowCreate(false);
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to save team");
    }
  };

  const confirmDelete = (team: Team) => {
    Alert.alert("Delete Team", `Delete "${team.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          await deleteTeam.mutateAsync({ id: team.id });
          qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        },
      },
    ]);
  };

  const toggleMember = (uid: number) => {
    setSelectedMembers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const filteredEmployees = (employees ?? []).filter(e =>
    e.name?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const teamsList = (teams ?? []) as Team[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Teams</Text>
        {isAdmin && (
          <TouchableOpacity onPress={openCreate} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>New Team</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={teamsList}
        keyExtractor={t => String(t.id)}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No teams yet"}
            </Text>
            {isAdmin && !isLoading && (
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tap "New Team" to create your first team</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.teamIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="users" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardInfo}>
                <Text style={[styles.cardName, { color: colors.foreground }]}>{item.name}</Text>
                {item.description && <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{item.description}</Text>}
              </View>
              {isAdmin && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                    <Feather name="edit-2" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.iconBtn}>
                    <Feather name="trash-2" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.members}>
              {item.members.length === 0 ? (
                <Text style={[styles.noMembers, { color: colors.mutedForeground }]}>No members</Text>
              ) : (
                item.members.slice(0, 8).map(m => (
                  <View key={m.userId} style={[styles.chip, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.chipText, { color: colors.foreground }]}>{m.name.split(" ")[0]}</Text>
                  </View>
                ))
              )}
              {item.members.length > 8 && (
                <View style={[styles.chip, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.chipText, { color: colors.primary }]}>+{item.members.length - 8}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editTeam ? "Edit Team" : "New Team"}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Team Name *</Text>
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                placeholder="e.g. Trenching Team"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                value={teamDesc}
                onChangeText={setTeamDesc}
                placeholder="Optional description"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Members ({selectedMembers.length} selected)</Text>
              <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Feather name="search" size={14} color={colors.mutedForeground} />
                <TextInput
                  value={memberSearch}
                  onChangeText={setMemberSearch}
                  placeholder="Search employees..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.searchInput, { color: colors.foreground }]}
                />
              </View>
              {filteredEmployees.map(e => {
                const selected = selectedMembers.includes(e.id);
                return (
                  <TouchableOpacity key={e.id} onPress={() => toggleMember(e.id)} style={[styles.memberRow, { borderColor: colors.border, backgroundColor: selected ? colors.primary + "10" : "transparent" }]}>
                    <View style={[styles.checkbox, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : "transparent" }]}>
                      {selected && <Feather name="check" size={12} color="#FFF" />}
                    </View>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{e.name}</Text>
                    <Text style={[styles.memberRole, { color: colors.mutedForeground }]}>{(e.role ?? "worker").replace("_", " ")}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setShowCreate(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveTeam} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.saveText}>{editTeam ? "Save Changes" : "Create Team"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  teamIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardDesc: { fontSize: 13, marginTop: 2 },
  cardActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 6 },
  divider: { height: 1, marginVertical: 10 },
  members: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  noMembers: { fontSize: 13 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 60, borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed" },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptySub: { fontSize: 13, textAlign: "center", paddingHorizontal: 20 },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "#00000060" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "85%", paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalBody: { paddingHorizontal: 20, paddingBottom: 8 },
  modalFooter: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  memberName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  memberRole: { fontSize: 12, textTransform: "capitalize" },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  saveText: { color: "#FFF", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
