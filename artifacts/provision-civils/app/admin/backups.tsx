import React from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListBackups, useCreateBackup, useRestoreBackup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Backup = {
  id: number;
  filename: string;
  sizeBytes?: number | null;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  restoredAt?: string | null;
};

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusColor(status: string, colors: ReturnType<typeof useColors>): string {
  if (status === "completed") return colors.success;
  if (status === "failed") return colors.destructive;
  if (status === "running") return colors.warning;
  return colors.mutedForeground;
}

function BackupItem({ item, onRestore }: { item: Backup; onRestore: (id: number, name: string) => void }) {
  const colors = useColors();
  const dt = new Date(item.createdAt);

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statusDot, { backgroundColor: statusColor(item.status, colors) }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.filename, { color: colors.foreground }]} numberOfLines={1}>{item.filename}</Text>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>•</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{formatBytes(item.sizeBytes)}</Text>
          <Text style={[styles.metaText, { color: statusColor(item.status, colors), fontFamily: "Inter_600SemiBold" }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        {item.errorMessage && (
          <Text style={[styles.error, { color: colors.destructive }]} numberOfLines={2}>{item.errorMessage}</Text>
        )}
        {item.restoredAt && (
          <Text style={[styles.metaText, { color: colors.success }]}>
            Restored: {new Date(item.restoredAt).toLocaleString()}
          </Text>
        )}
      </View>
      {item.status === "completed" && (
        <TouchableOpacity
          style={[styles.restoreBtn, { borderColor: colors.primary }]}
          onPress={() => onRestore(item.id, item.filename)}
        >
          <Text style={[styles.restoreBtnText, { color: colors.primary }]}>Restore</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function BackupsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const qc = useQueryClient();

  const { data: backups = [], isLoading, refetch } = useListBackups({
    query: { queryKey: ["backups"], refetchInterval: 15000 },
  });
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();

  const handleCreate = async () => {
    Alert.alert("Create Backup", "Start a manual database backup now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start Backup", onPress: async () => {
          try {
            await createBackup.mutateAsync({ data: undefined } as any);
            Alert.alert("Backup Started", "Backup is running in the background. Refresh in a moment to see the result.");
            setTimeout(() => { refetch(); }, 5000);
          } catch {
            Alert.alert("Error", "Failed to start backup.");
          }
        },
      },
    ]);
  };

  const handleRestore = (id: number, name: string) => {
    Alert.alert(
      "Restore Database",
      `⚠️ This will overwrite all current data with the backup:\n\n${name}\n\nThis action cannot be undone. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore", style: "destructive", onPress: async () => {
            try {
              await restoreBackup.mutateAsync({ id } as any);
              Alert.alert("Success", "Database restored successfully.");
            } catch {
              Alert.alert("Error", "Restore failed. Check server logs.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Database Backups</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Auto daily at 02:00 · Keep 30</Text>
        </View>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={handleCreate}
          disabled={createBackup.isPending}
        >
          {createBackup.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Feather name="upload-cloud" size={16} color="#fff" /><Text style={styles.createBtnText}>Backup Now</Text></>
          }
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={backups as Backup[]}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => <BackupItem item={item} onRestore={handleRestore} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="database" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No backups yet</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
                First automatic backup runs at 02:00
              </Text>
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
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  createBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  createBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  item: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  statusDot: { width: 4, borderRadius: 2, alignSelf: "stretch", marginTop: 6 },
  filename: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  error: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4 },
  restoreBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  restoreBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
