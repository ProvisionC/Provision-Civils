import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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

const TODAY_STR = new Date().toISOString().split("T")[0];

export default function JobsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ status?: string; dateFilter?: string }>();

  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(params.status ?? "");
  const [dateFilter, setDateFilter] = useState(params.dateFilter ?? "");

  // Re-apply filters when navigated from dashboard
  useEffect(() => {
    if (params.status !== undefined) setSelectedStatus(params.status ?? "");
    if (params.dateFilter !== undefined) {
      setDateFilter(params.dateFilter ?? "");
      setSelectedStatus(""); // clear status filter when using date filter
    }
  }, [params.status, params.dateFilter]);

  // Fetch jobs — when date-filtering we need all jobs to filter client-side
  const apiStatus = dateFilter ? undefined : (selectedStatus || undefined);
  const { data: allJobs, isLoading, refetch } = useListJobs(
    { status: apiStatus, search: search || undefined },
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Apply client-side date filters (overdue / due today)
  const jobs = useMemo(() => {
    if (!allJobs) return [];
    if (!dateFilter) return allJobs;

    return allJobs.filter(job => {
      const endDate = (job as any).endDate ?? (job as any).deadline ?? null;
      if (!endDate) return false;
      const end = endDate.slice(0, 10);
      const status = (job as any).status ?? "";
      const isDone = status === "completed" || status === "cancelled";

      if (dateFilter === "overdue") {
        return !isDone && end < TODAY_STR;
      }
      if (dateFilter === "today") {
        return end === TODAY_STR;
      }
      return true;
    });
  }, [allJobs, dateFilter]);

  const activeFilter = dateFilter
    ? (dateFilter === "overdue" ? "Overdue" : "Due Today")
    : (STATUSES.find(s => s.key === selectedStatus)?.label ?? "All");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Jobs</Text>
            {(dateFilter || selectedStatus) ? (
              <Text style={[styles.filterBadge, { color: colors.primary }]}>
                Filtered: {activeFilter}
              </Text>
            ) : null}
          </View>
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

        {/* Status chips */}
        {!dateFilter && (
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
        )}

        {/* Date filter active — show clear chip */}
        {dateFilter ? (
          <View style={styles.filters}>
            <View style={[styles.filterChip, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={[styles.filterText, { color: "#FFF" }]}>{activeFilter}</Text>
            </View>
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => setDateFilter("")}
            >
              <Feather name="x" size={12} color={colors.mutedForeground} />
              <Text style={[styles.filterText, { color: colors.mutedForeground }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <FlatList
        data={jobs}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="briefcase" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading jobs..." : `No ${activeFilter.toLowerCase()} jobs`}
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  filterBadge: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchBar: {
    flexDirection: "row", alignItems: "center", borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filters: { flexDirection: "row", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
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
