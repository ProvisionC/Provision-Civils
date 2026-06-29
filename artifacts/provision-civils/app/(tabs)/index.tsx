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
import { Image } from "react-native";

const FMT = (n: number | null | undefined) => n != null
  ? "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  : "R —";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPM = user?.role === "project_manager";

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetDashboardStats();
  const s = stats as any;
  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = useListJobs(
    { status: "active" },
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()},</Text>
          <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? "User"}</Text>
          <Text style={[styles.role, { color: colors.primary }]}>
            {user?.role === "admin" ? "Administrator" : user?.role === "project_manager" ? "Project Manager" : user?.role === "supervisor" ? "Supervisor" : "Field Worker"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/job/create")}
          >
            <Feather name="plus" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Wayleave alert */}
      {(s?.pendingWayleave ?? 0) > 0 && isAdmin && (
        <TouchableOpacity
          style={[styles.wayleaveAlert, { backgroundColor: "#FFF3E0", borderColor: "#FF8F00" }]}
          onPress={() => router.push({ pathname: "/jobs" as any, params: { status: "waiting_for_wayleave" } })}
        >
          <Feather name="alert-triangle" size={18} color="#E65100" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.wayleaveAlertText, { color: "#BF360C" }]}>
              {s.pendingWayleave} job{s.pendingWayleave !== 1 ? "s" : ""} waiting for Wayleave
            </Text>
            <Text style={{ color: "#E65100", fontSize: 12, fontFamily: "Inter_400Regular" }}>Tap to review →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Operational stats */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Operations</Text>
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
            icon={<Feather name="clock" size={20} color={colors.destructive} />}
          />
          <StatCard
            label="Due Today"
            value={stats?.jobsDueToday ?? 0}
            color={colors.warning}
            icon={<Feather name="calendar" size={20} color={colors.warning} />}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Team"
            value={stats?.totalEmployees ?? 0}
            color={colors.secondary}
            icon={<Feather name="users" size={20} color={colors.secondary} />}
          />
          <StatCard
            label="Invoices"
            value={stats?.totalInvoices ?? 0}
            color="#7B1FA2"
            icon={<Feather name="file-text" size={20} color="#7B1FA2" />}
          />
        </View>
      </View>

      {/* Financial overview (admin only) */}
      {isAdmin && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Financial Overview</Text>
          <View style={[styles.financeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.financeRow}>
              <View style={[styles.financeItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
                <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>Contract Value</Text>
                <Text style={[styles.financeValue, { color: colors.primary }]}>{FMT(s?.totalContractValue)}</Text>
              </View>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>Invoiced</Text>
                <Text style={[styles.financeValue, { color: colors.success }]}>{FMT(s?.totalInvoiced)}</Text>
              </View>
            </View>
            <View style={[styles.financeRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={[styles.financeItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
                <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>Expenses</Text>
                <Text style={[styles.financeValue, { color: colors.destructive }]}>{FMT(s?.totalExpenses)}</Text>
              </View>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.mutedForeground }]}>Est. Profit</Text>
                <Text style={[
                  styles.financeValue,
                  { color: (s?.estimatedProfit ?? 0) >= 0 ? colors.success : colors.destructive }
                ]}>
                  {FMT(s?.estimatedProfit)}
                </Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* In-progress jobs */}
      <View style={styles.feedHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Jobs</Text>
        <TouchableOpacity onPress={() => router.push("/jobs" as any)}>
          <Text style={[styles.viewAll, { color: colors.primary }]}>View all →</Text>
        </TouchableOpacity>
      </View>

      {jobsLoading ? (
        <View style={[styles.loadingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading jobs...</Text>
        </View>
      ) : (jobs?.length ?? 0) === 0 ? (
        <View style={[styles.emptyJobs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="briefcase" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active jobs right now</Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/job/create")}
          >
            <Feather name="plus" size={16} color="#FFF" />
            <Text style={styles.createBtnText}>Create Job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.feed}>
          {jobs!.slice(0, 6).map(job => (
            <JobCard key={job.id} job={job} onPress={() => router.push(`/job/${job.id}` as any)} />
          ))}
          {jobs!.length > 6 && (
            <TouchableOpacity
              style={[styles.moreBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => router.push("/jobs" as any)}
            >
              <Text style={[styles.moreBtnText, { color: colors.mutedForeground }]}>
                +{jobs!.length - 6} more jobs →
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <QuickAction colors={colors} icon="briefcase" label="New Job" onPress={() => router.push("/job/create")} color={colors.primary} />
        {(isAdmin || isPM) && (
          <QuickAction colors={colors} icon="users" label="New Client" onPress={() => router.push("/client/create")} color="#0097A7" />
        )}
        <QuickAction colors={colors} icon="user-plus" label="Add Employee" onPress={() => router.push("/employee/create" as any)} color={colors.secondary} />
        <QuickAction colors={colors} icon="file-text" label="New Invoice" onPress={() => router.push("/invoice/create" as any)} color="#7B1FA2" />
      </View>
    </ScrollView>
  );
}

function QuickAction({ colors, icon, label, onPress, color }: { colors: any; icon: string; label: string; onPress: () => void; color: string }) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.quickActionLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 4 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  headerRight: { alignItems: "center", gap: 8 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  role: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  wayleaveAlert: { borderRadius: 12, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  wayleaveAlertText: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 2 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 12, marginBottom: 8 },
  statsGrid: { gap: 10 },
  statsRow: { flexDirection: "row", gap: 10 },
  financeCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 4 },
  financeRow: { flexDirection: "row" },
  financeItem: { flex: 1, padding: 16, gap: 4 },
  financeLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  financeValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  feedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, marginBottom: 8 },
  viewAll: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  feed: { gap: 10 },
  loadingBox: { borderRadius: 12, padding: 24, borderWidth: 1, alignItems: "center" },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyJobs: { borderRadius: 14, padding: 32, borderWidth: 1, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  createBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  createBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  moreBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: "center" },
  moreBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickAction: { flex: 1, minWidth: "44%", borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
