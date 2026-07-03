import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Platform, ScrollView, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListCrashReports, useResolveCrashReport } from "@workspace/api-client-react";

type CrashReport = {
  id: number;
  userId?: number | null;
  userName?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  deviceInfo?: unknown;
  errorMessage: string;
  stackTrace?: string | null;
  resolved: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ReportDetail({ report, onClose, onResolve }: {
  report: CrashReport;
  onClose: () => void;
  onResolve: () => void;
}) {
  const colors = useColors();
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Feather name="x" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Crash Report #{report.id}</Text>
          {!report.resolved && (
            <TouchableOpacity style={[styles.resolveBtn, { backgroundColor: colors.success }]} onPress={onResolve}>
              <Text style={styles.resolveBtnText}>Resolve</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ERROR</Text>
            <Text style={[styles.errorMsg, { color: colors.destructive }]}>{report.errorMessage}</Text>
          </View>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DETAILS</Text>
            {[
              ["User", report.userName ?? "Unknown"],
              ["App Version", report.appVersion ?? "—"],
              ["Platform", report.platform ?? "—"],
              ["Time", new Date(report.createdAt).toLocaleString()],
              ["Status", report.resolved ? "✅ Resolved" : "⚠️ Open"],
            ].map(([k, v]) => (
              <View key={k} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.detailKey, { color: colors.mutedForeground }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: colors.foreground }]}>{v}</Text>
              </View>
            ))}
          </View>
          {report.stackTrace && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>STACK TRACE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <Text style={[styles.stackTrace, { color: colors.mutedForeground }]}>{report.stackTrace}</Text>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CrashReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [showResolved, setShowResolved] = useState(false);
  const [selected, setSelected] = useState<CrashReport | null>(null);

  const { data: reports = [], isLoading, refetch } = useListCrashReports(
    showResolved ? { resolved: true } : {},
    { query: { queryKey: ["crash-reports", showResolved] } }
  );
  const resolveMutation = useResolveCrashReport();

  const handleResolve = async (id: number) => {
    try {
      await resolveMutation.mutateAsync({ id } as any);
      setSelected(null);
      refetch();
    } catch { /* ignore */ }
  };

  const crashReports = reports as CrashReport[];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Crash Reports</Text>
        <TouchableOpacity
          style={[styles.toggleBtn, { backgroundColor: showResolved ? colors.muted : colors.primary + "20" }]}
          onPress={() => setShowResolved(!showResolved)}
        >
          <Text style={[styles.toggleBtnText, { color: showResolved ? colors.mutedForeground : colors.primary }]}>
            {showResolved ? "Open" : "Resolved"}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={crashReports}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setSelected(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIcon, { backgroundColor: item.resolved ? colors.success + "20" : colors.destructive + "20" }]}>
                <Feather name={item.resolved ? "check-circle" : "alert-circle"} size={20}
                  color={item.resolved ? colors.success : colors.destructive} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.errorMsg, { color: colors.foreground }]} numberOfLines={2}>{item.errorMessage}</Text>
                <View style={styles.metaRow}>
                  {item.userName && <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.userName}</Text>}
                  {item.appVersion && <Text style={[styles.metaText, { color: colors.mutedForeground }]}>v{item.appVersion}</Text>}
                  {item.platform && <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{item.platform}</Text>}
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="check-circle" size={40} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {showResolved ? "No resolved reports" : "No crash reports — great!"}
              </Text>
            </View>
          }
          onRefresh={refetch}
          refreshing={isLoading}
        />
      )}

      {selected && (
        <ReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          onResolve={() => handleResolve(selected.id)}
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
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  toggleBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  item: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  errorMsg: { fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  resolveBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  resolveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  section: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Inter_500Medium" },
  detailVal: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "right", flex: 1, marginLeft: 16 },
  stackTrace: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
