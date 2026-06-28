import React from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useGetDashboardStats, useListJobs } from "@workspace/api-client-react";
import { StatCard } from "@/components/StatCard";
import { JobCard } from "@/components/JobCard";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useListJobs(
    { status: "in_progress" },
  );

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchJobs()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: bottomPad + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? "User"}</Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/job/create")}
        >
          <Feather name="plus" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <StatCard
            label="Active Jobs"
            value={stats?.activeJobs ?? 0}
            color={colors.primary}
            icon={<Feather name="briefcase" size={20} color={colors.primary} />}
          />
          <StatCard
            label="Completed"
            value={stats?.completedJobs ?? 0}
            color={colors.success}
            icon={<Feather name="check-circle" size={20} color={colors.success} />}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Overdue"
            value={stats?.overdueJobs ?? 0}
            color={colors.destructive}
            icon={<Feather name="alert-circle" size={20} color={colors.destructive} />}
          />
          <StatCard
            label="Due Today"
            value={stats?.jobsDueToday ?? 0}
            color={colors.warning}
            icon={<Feather name="clock" size={20} color={colors.warning} />}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Employees"
            value={stats?.totalEmployees ?? 0}
            color="#7B1FA2"
            icon={<Feather name="users" size={20} color="#7B1FA2" />}
          />
          <StatCard
            label="Invoices"
            value={stats?.totalInvoices ?? 0}
            color={colors.secondary}
            icon={<Feather name="file-text" size={20} color={colors.secondary} />}
          />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Jobs</Text>
        <TouchableOpacity onPress={() => router.push("/(tabs)/jobs")}>
          <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
        </TouchableOpacity>
      </View>

      {jobsLoading ? (
        <View style={[styles.skeleton, { backgroundColor: colors.muted }]} />
      ) : jobs?.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="briefcase" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active jobs</Text>
        </View>
      ) : (
        jobs?.slice(0, 5).map(job => (
          <JobCard
            key={job.id}
            job={job}
            onPress={() => router.push(`/job/${job.id}` as any)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 14 },
  statsGrid: { gap: 10, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  seeAll: { fontSize: 14, fontFamily: "Inter_500Medium" },
  skeleton: { height: 80, borderRadius: 12, marginBottom: 10 },
  empty: {
    borderRadius: 12, padding: 32, borderWidth: 1,
    alignItems: "center", gap: 8,
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
