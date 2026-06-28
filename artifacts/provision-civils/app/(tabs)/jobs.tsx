import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListJobs } from "@workspace/api-client-react";
import { JobCard } from "@/components/JobCard";

const STATUSES = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting_for_materials", label: "Waiting" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const { data: jobs, isLoading, refetch } = useListJobs(
    { status: selectedStatus || undefined, search: search || undefined },
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Jobs</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/job/create")}
          >
            <Feather name="plus" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by client name..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        <FlatList
          horizontal
          data={STATUSES}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedStatus === item.key ? colors.primary : colors.muted,
                  borderColor: selectedStatus === item.key ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedStatus(item.key)}
            >
              <Text style={[
                styles.filterText,
                { color: selectedStatus === item.key ? "#FFF" : colors.mutedForeground },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={jobs ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        scrollEnabled={!!(jobs && jobs.length > 0)}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="briefcase" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No jobs found"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <JobCard job={item} onPress={() => router.push(`/job/${item.id}` as any)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flexDirection: "row", alignItems: "center", borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filters: { marginBottom: 4 },
  filterChip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1,
  },
  filterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  list: { padding: 16 },
  empty: {
    alignItems: "center", gap: 12, paddingVertical: 60,
    borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
