import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Pressable, Platform, Alert, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  useListAnnouncements, useCreateAnnouncement, useDeleteAnnouncement,
  getListAnnouncementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Announcement = {
  id: number;
  title: string;
  category: string;
  content: string;
  priority: string;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  expiresAt: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  toolbox_talk: "Toolbox Talk",
  safety_notice: "Safety Notice",
  site_closed: "Site Closed",
  weather_warning: "Weather Warning",
  new_procedure: "New Procedure",
  emergency: "Emergency",
};

const PRIORITY_COLORS: Record<string, string> = {
  normal: "#6B7280",
  high: "#F59E0B",
  emergency: "#EF4444",
};

const CATEGORIES = ["general", "toolbox_talk", "safety_notice", "site_closed", "weather_warning", "new_procedure", "emergency"];
const PRIORITIES = ["normal", "high", "emergency"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function AnnouncementCard({ ann, canDelete, onDelete, colors }: {
  ann: Announcement; canDelete: boolean; onDelete: () => void; colors: any;
}) {
  const priorityColor = PRIORITY_COLORS[ann.priority] ?? "#6B7280";
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: priorityColor, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.catBadge, { backgroundColor: priorityColor + "18" }]}>
          <Text style={[styles.catText, { color: priorityColor }]}>{CATEGORY_LABELS[ann.category] ?? ann.category}</Text>
        </View>
        {canDelete && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Feather name="trash-2" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{ann.title}</Text>
      <Text style={[styles.cardContent, { color: colors.mutedForeground }]}>{ann.content}</Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {ann.createdByName ?? "System"} · {formatDate(ann.createdAt)}
        </Text>
        {ann.expiresAt && (
          <Text style={[styles.cardExpiry, { color: "#F59E0B" }]}>Expires {formatDate(ann.expiresAt)}</Text>
        )}
      </View>
    </View>
  );
}

export default function AnnouncementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const role = (user as any)?.role ?? "worker";
  const isAdmin = role === "admin" || role === "project_manager";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [expiresAt, setExpiresAt] = useState("");

  const { data: announcements, isLoading, refetch } = useListAnnouncements({ query: { queryKey: getListAnnouncementsQueryKey(), staleTime: 30000 } });
  const createAnn = useCreateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) { Alert.alert("Error", "Title and content are required"); return; }
    try {
      await createAnn.mutateAsync({
        data: {
          title: title.trim(), content: content.trim(),
          category: category as any, priority: priority as any,
          expiresAt: expiresAt.trim() || undefined,
        },
      });
      invalidate();
      setShowCreate(false);
      setTitle(""); setContent(""); setCategory("general"); setPriority("normal"); setExpiresAt("");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to create announcement");
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Announcement", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteAnn.mutateAsync({ id });
        invalidate();
      }},
    ]);
  };

  const anns = (announcements ?? []) as Announcement[];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>📢 Announcements</Text>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowCreate(true)} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
            <Feather name="plus" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : anns.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No announcements yet</Text>
        </View>
      ) : (
        <FlatList
          data={anns}
          keyExtractor={a => String(a.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AnnouncementCard
              ann={item} canDelete={isAdmin} colors={colors}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {/* CREATE MODAL */}
      <Modal transparent animationType="slide" visible={showCreate} onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={e => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>New Announcement</Text>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title *"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Content *"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={[styles.textarea, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.background, borderColor: category === c ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: category === c ? "#FFF" : colors.foreground }]}>{CATEGORY_LABELS[c]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Priority</Text>
            <View style={styles.chips}>
              {PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.chip, { backgroundColor: priority === p ? PRIORITY_COLORS[p] : colors.background, borderColor: priority === p ? PRIORITY_COLORS[p] : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: priority === p ? "#FFF" : colors.foreground }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              value={expiresAt}
              onChangeText={setExpiresAt}
              placeholder="Expires at (YYYY-MM-DD, optional)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />

            <TouchableOpacity
              onPress={handleCreate}
              disabled={createAnn.isPending}
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            >
              {createAnn.isPending ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Post Announcement</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  back: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  createBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 4 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardContent: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardExpiry: { fontSize: 11, fontFamily: "Inter_500Medium" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty: { fontSize: 14, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  textarea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
