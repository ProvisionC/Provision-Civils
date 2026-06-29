import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import {
  useGetPayrollSummary, useGetPayrollEntries,
  getGetPayrollSummaryQueryKey, getGetPayrollEntriesQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { usePdfExport } from "@/hooks/usePdfExport";

// ─── Component ────────────────────────────────────────────────────────────────
export default function EmployeePayrollScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ employeeId: string; startDate: string; endDate: string }>();

  const employeeId = parseInt(params.employeeId ?? "0", 10);
  const startDate  = params.startDate ?? "";
  const endDate    = params.endDate ?? "";

  const summaryParams = { startDate, endDate, employeeId };
  const { data: summaryArr, isLoading: loadSum } = useGetPayrollSummary(
    summaryParams,
    { query: { queryKey: getGetPayrollSummaryQueryKey(summaryParams) } },
  );
  const { data: entries, isLoading: loadEnt } = useGetPayrollEntries(
    summaryParams,
    { query: { queryKey: getGetPayrollEntriesQueryKey(summaryParams) } },
  );

  const { isExporting, exportPdf } = usePdfExport();
  const s = makeStyles(colors);

  // Admin-only
  if (user?.role !== "admin") {
    return (
      <View style={s.denied}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[s.deniedTitle, { color: colors.foreground }]}>Admin Access Only</Text>
      </View>
    );
  }

  const summary = summaryArr?.[0];
  const isLoading = loadSum || loadEnt;

  const hourlyEntries = entries?.filter((e: any) => e.payrollType === "hourly") ?? [];
  const pieceEntries  = entries?.filter((e: any) => e.payrollType === "piece_work") ?? [];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
            {isLoading ? "Loading…" : (summary?.employeeName ?? "Employee")}
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {startDate} → {endDate}
          </Text>
        </View>
        {isExporting && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />}
        <TouchableOpacity
          style={[s.printBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
          onPress={() => {
            if (!summary) return;
            exportPdf({
              endpoint: `/api/payroll/pdf/employee/${employeeId}?startDate=${startDate}&endDate=${endDate}`,
              filename: `Payroll-${summary.employeeName.replace(/[^a-z0-9]/gi, "-")}-${startDate}-${endDate}.pdf`,
            });
          }}
          disabled={isExporting}
        >
          <Feather name="file-text" size={15} color="#FFF" />
          <Text style={s.printBtnText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadText, { color: colors.mutedForeground }]}>Loading payroll…</Text>
        </View>
      ) : !summary ? (
        <View style={s.center}>
          <Feather name="user-x" size={44} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Payroll Data</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            No completed labour entries for this employee in this period.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>

          {/* ── Employee info card ── */}
          <View style={[s.infoCard, { backgroundColor: colors.card, borderColor: colors.primary + "40" }]}>
            <View style={[s.avatar, { backgroundColor: colors.primary + "18" }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {summary.employeeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[s.empName, { color: colors.foreground }]}>{summary.employeeName}</Text>
              <View style={s.infoRow}>
                <View style={s.infoPill}>
                  <Text style={[s.infoPillLabel, { color: colors.mutedForeground }]}>Emp #</Text>
                  <Text style={[s.infoPillValue, { color: colors.foreground }]}>{summary.employeeNumber ?? "—"}</Text>
                </View>
                <View style={s.infoPill}>
                  <Text style={[s.infoPillLabel, { color: colors.mutedForeground }]}>Clock #</Text>
                  <Text style={[s.infoPillValue, { color: colors.foreground }]}>{summary.clockNumber ?? "—"}</Text>
                </View>
                <View style={s.infoPill}>
                  <Text style={[s.infoPillLabel, { color: colors.mutedForeground }]}>Entries</Text>
                  <Text style={[s.infoPillValue, { color: colors.foreground }]}>{summary.entryCount}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Earnings summary ── */}
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Earnings Summary</Text>
          <View style={s.earningsGrid}>
            {summary.totalHours > 0 && (
              <View style={[s.earningBox, { backgroundColor: "#2563EB12", borderColor: "#2563EB30" }]}>
                <Feather name="clock" size={18} color="#2563EB" />
                <Text style={[s.earningLabel, { color: "#2563EB" }]}>Hourly Earnings</Text>
                <Text style={[s.earningHours, { color: colors.mutedForeground }]}>{summary.totalHours.toFixed(1)} hours</Text>
                <Text style={[s.earningAmount, { color: "#2563EB" }]}>R {summary.hourlyAmount.toFixed(2)}</Text>
              </View>
            )}
            {summary.totalMeters > 0 && (
              <View style={[s.earningBox, { backgroundColor: "#8B5CF612", borderColor: "#8B5CF630" }]}>
                <Feather name="activity" size={18} color="#8B5CF6" />
                <Text style={[s.earningLabel, { color: "#8B5CF6" }]}>Piece Work</Text>
                <Text style={[s.earningHours, { color: colors.mutedForeground }]}>{summary.totalMeters.toFixed(0)} m total</Text>
                {summary.metersAt25 > 0 && <Text style={[s.rateBreak, { color: colors.mutedForeground }]}>{summary.metersAt25.toFixed(0)} m @ R25</Text>}
                {summary.metersAt30 > 0 && <Text style={[s.rateBreak, { color: colors.mutedForeground }]}>{summary.metersAt30.toFixed(0)} m @ R30</Text>}
                <Text style={[s.earningAmount, { color: "#8B5CF6" }]}>R {summary.pieceAmount.toFixed(2)}</Text>
              </View>
            )}
            <View style={[s.earningBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Feather name="award" size={18} color="#22C55E" />
              <Text style={[s.earningLabel, { color: colors.foreground }]}>Total Gross Pay</Text>
              <Text style={[s.earningAmount, { color: "#22C55E", fontSize: 22 }]}>R {summary.totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* ── Hourly entries ── */}
          {hourlyEntries.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <View style={[s.sectionDot, { backgroundColor: "#2563EB" }]} />
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Hourly Labour Entries</Text>
                <Text style={[s.sectionCount, { color: "#2563EB", backgroundColor: "#2563EB18" }]}>
                  {hourlyEntries.length}
                </Text>
              </View>
              {(hourlyEntries as any[]).map(e => (
                <View key={e.id} style={[s.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={s.entryHeader}>
                    <View style={[s.entryTypeDot, { backgroundColor: "#2563EB" }]} />
                    <Text style={[s.entryDate, { color: colors.foreground }]}>{e.date}</Text>
                    <Text style={[s.entryAmt, { color: "#2563EB" }]}>R {Number(e.amountPayable ?? 0).toFixed(2)}</Text>
                  </View>
                  <View style={s.entryStats}>
                    <View style={s.entryStat}>
                      <Feather name="clock" size={11} color={colors.mutedForeground} />
                      <Text style={[s.entryStatText, { color: colors.mutedForeground }]}>
                        {e.clockIn ?? "—"} – {e.clockOut ?? "—"}
                      </Text>
                    </View>
                    <View style={s.entryStat}>
                      <Feather name="activity" size={11} color={colors.mutedForeground} />
                      <Text style={[s.entryStatText, { color: colors.mutedForeground }]}>
                        {Number(e.hoursWorked ?? 0).toFixed(2)} hrs
                      </Text>
                    </View>
                    {e.rateUsed && (
                      <View style={s.entryStat}>
                        <Text style={[s.entryStatText, { color: colors.mutedForeground }]}>
                          @ R{e.rateUsed}/hr
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Piece work entries ── */}
          {pieceEntries.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: hourlyEntries.length > 0 ? 16 : 0 }]}>
                <View style={[s.sectionDot, { backgroundColor: "#8B5CF6" }]} />
                <Text style={[s.sectionTitle, { color: colors.foreground }]}>Piece Work Entries</Text>
                <Text style={[s.sectionCount, { color: "#8B5CF6", backgroundColor: "#8B5CF618" }]}>
                  {pieceEntries.length}
                </Text>
              </View>
              {(pieceEntries as any[]).map(e => {
                const isComplete = e.status === "complete";
                return (
                  <View key={e.id} style={[s.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.entryHeader}>
                      <View style={[s.entryTypeDot, { backgroundColor: "#8B5CF6" }]} />
                      <Text style={[s.entryDate, { color: colors.foreground }]}>{e.date}</Text>
                      <View style={[s.statusChip, { backgroundColor: isComplete ? "#22C55E18" : "#F59E0B18" }]}>
                        <Text style={{ color: isComplete ? "#22C55E" : "#F59E0B", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                          {isComplete ? "Complete" : "Open"}
                        </Text>
                      </View>
                      <Text style={[s.entryAmt, { color: isComplete ? "#8B5CF6" : colors.mutedForeground }]}>
                        R {isComplete ? Number(e.amountPayable ?? 0).toFixed(2) : "0.00"}
                      </Text>
                    </View>
                    <View style={s.entryStats}>
                      {e.metersCompleted && (
                        <View style={s.entryStat}>
                          <Feather name="activity" size={11} color={colors.mutedForeground} />
                          <Text style={[s.entryStatText, { color: colors.mutedForeground }]}>
                            {Number(e.metersCompleted).toFixed(0)} m
                          </Text>
                        </View>
                      )}
                      {e.rateUsed && (
                        <View style={s.entryStat}>
                          <Text style={[s.entryStatText, { color: colors.mutedForeground }]}>
                            @ R{e.rateUsed}/m
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: colors.background },
    denied:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
    deniedTitle:{ fontFamily: "Inter_700Bold", fontSize: 20 },

    header:   { flexDirection: "row", alignItems: "center", gap: 12,
                paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1 },
    backBtn:  { padding: 4 },
    title:    { fontFamily: "Inter_700Bold", fontSize: 20 },
    subtitle: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    printBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10,
                paddingHorizontal: 14, paddingVertical: 9 },
    printBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },

    center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
    loadText:  { fontFamily: "Inter_400Regular", fontSize: 14 },
    emptyTitle:{ fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },

    infoCard: { flexDirection: "row", gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 20 },
    avatar:   { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    avatarText:{ fontFamily: "Inter_700Bold", fontSize: 19 },
    empName:  { fontFamily: "Inter_700Bold", fontSize: 17 },
    infoRow:  { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    infoPill: { borderRadius: 8, backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 5 },
    infoPillLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
    infoPillValue: { fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 1 },

    sectionRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    sectionDot:   { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, flex: 1, marginBottom: 10 },
    sectionCount: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
                    fontFamily: "Inter_600SemiBold", fontSize: 12 },

    earningsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
    earningBox:   { flex: 1, minWidth: 130, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4 },
    earningLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
    earningHours: { fontFamily: "Inter_400Regular", fontSize: 12 },
    rateBreak:    { fontFamily: "Inter_400Regular", fontSize: 11 },
    earningAmount:{ fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 4 },

    entryCard:   { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
    entryHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    entryTypeDot:{ width: 8, height: 8, borderRadius: 4 },
    entryDate:   { fontFamily: "Inter_600SemiBold", fontSize: 14, flex: 1 },
    entryAmt:    { fontFamily: "Inter_700Bold", fontSize: 14 },
    statusChip:  { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
    entryStats:  { flexDirection: "row", gap: 14, flexWrap: "wrap" },
    entryStat:   { flexDirection: "row", alignItems: "center", gap: 4 },
    entryStatText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  });
}
