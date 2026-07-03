import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListRecycleBin, useRestoreRecycleBinItem, usePermanentlyDeleteItem } from "@workspace/api-client-react";

type RecycleType = "job" | "client" | "employee" | "invoice" | "photo";

type RecycleBinItem = {
  id: number;
  type: string;
  name: string;
  deletedAt: string;
  metadata?: unknown;
};

const TYPE_ICON: Record<string, string> = {
  job: "briefcase",
  client: "users",
  employee: "user",
  invoice: "file-text",
  photo: "image",
};

const TYPE_COLOR: Record<string, string> = {
  job: "#1565C0",
  client: "#0891B2",
  employee: "#7C3AED",
  invoice: "#FF6F00",
  photo: "#059669",
};

const FILTERS: { label: string; value: RecycleType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Jobs", value: "job" },
  { label: "Clients", value: "client" },
  { label: "Employees", value: "employee" },
  { label: "Invoices", value: "invoice" },
  { label: "Photos", value: "photo" },
];

function RecycleItem({ item, onRestore, onDelete }: {
  item: RecycleBinItem;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const typeColor = TYPE_COLOR[item.type] ?? colors.mutedForeground;
  const iconName = TYPE_ICON[item.type] ?? "file";

  return (
    <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.typeIcon, { backgroundColor: typeColor + "20" }]}>
        <Feather name={iconName as any} size={20} color={typeColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
        <View style={styles.itemMeta}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + "15" }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{item.type.toUpperCase()}</Text>
          </View>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            Deleted {new Date(item.deletedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onRestore} style={[styles.actionBtn, { backgroundColor: colors.success + "20" }]}>
          <Feather name="rotate-ccw" size={15} color={colors.success} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { backgroundColor: colors.destructive + "20" }]}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RecycleBinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [filter, setFilter] = useState<RecycleType | "all">("all");

  const { data: items = [], isLoading, refetch } = useListRecycleBin(
    filter !== "all" ? { type: filter } : {},
    { query: { queryKey: ["recycle-bin", filter] } }
  );
  const restoreMutation = useRestoreRecycleBinItem();
  const deleteMutation = usePermanentlyDeleteItem();

  const handleRestore = (item: RecycleBinItem) => {
    Alert.alert("Restore Item", `Restore "${item.name}" from the recycle bin?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore", onPress: async () => {
          try {
            await restoreMutation.mutateAsync({ type: item.type as RecycleType, id: item.id } as any);
            refetch();
          } catch {
            Alert.alert("Error", "Failed to restore item.");
          }
        },
      },
    ]);
  };

  const handleDelete = (item: RecycleBinItem) => {
    Alert.alert(
      "Permanently Delete",
      `⚠️ Permanently delete "${item.name}"?\n\nThis action CANNOT be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever", style: "destructive", onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ type: item.type as RecycleType, id: item.id } as any);
              refetch();
            } catch {
              Alert.alert("Error", "Failed to delete item.");
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
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Recycle Bin</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{items.length} item{items.length !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.filterChip, {
              backgroundColor: filter === f.value ? colors.primary : colors.muted,
            }]}
          >
            <Text style={[styles.filterChipText, { color: filter === f.value ? "#fff" : colors.mutedForeground }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items as RecycleBinItem[]}
          keyExtractor={i => `${i.type}-${i.id}`}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <RecycleItem
              item={item}
              onRestore={() => handleRestore(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="trash-2" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Recycle bin is empty</Text>
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
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  filterRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  item: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
