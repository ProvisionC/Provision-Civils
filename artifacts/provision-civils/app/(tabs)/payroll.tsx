import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useGetPayrollSummary, useGetPayrollEntries, useListEmployees, getGetPayrollEntriesQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const TODAY = new Date();
const firstOfMonth = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-01`;
const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

type ViewMode = "summary" | "detail";

export default function PayrollScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [selectedEmpId, setSelectedEmpId] = useState<number | undefined>();

  const { data: summary, isLoading: loadingSummary } = useGetPayrollSummary({
    startDate, endDate,
    ...(selectedEmpId ? { employeeId: selectedEmpId } : {}),
  });

  const entryParams = { startDate, endDate, ...(selectedEmpId ? { employeeId: selectedEmpId } : {}) };
  const { data: entries, isLoading: loadingDetail } = useGetPayrollEntries(
    entryParams,
    { query: { queryKey: getGetPayrollEntriesQueryKey(entryParams), enabled: viewMode === "detail" } }
  );

  const { data: employees } = useListEmployees();

  // Grand totals
  const grandTotal = summary?.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0) ?? 0;
  const grandHours = summary?.reduce((s, r) => s + Number(r.totalHours ?? 0), 0) ?? 0;
  const grandMeters = summary?.reduce((s, r) => s + Number(r.totalMeters ?? 0), 0) ?? 0;
  const hourlyTotal = summary?.reduce((s, r) => s + Number((r as any).hourlyAmount ?? 0), 0) ?? 0;
  const pieceTotal = summary?.reduce((s, r) => s + Number((r as any).pieceAmount ?? 0), 0) ?? 0;

  // Split detail entries by type
  const hourlyEntries = entries?.filter((e: any) => e.payrollType === "hourly") ?? [];
  const pieceEntries = entries?.filter((e: any) => e.payrollType === "piece_work") ?? [];

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Payroll</Text>
      </View>

      {/* Date range filters */}
      <View style={s.filterRow}>
        <View style={s.dateField}>
          <Text style={[s.dateLabel, { color: colors.mutedForeground }]}>From</Text>
          <TextInput
            style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            value={startDate} onChangeText={setStartDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={s.dateField}>
          <Text style={[s.dateLabel, { color: colors.mutedForeground }]}>To</Text>
          <TextInput
            style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            value={endDate} onChangeText={setEndDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
          />
        </View>
      </View>

      {/* Employee filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.empFilterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <TouchableOpacity style={[s.empChip, { borderColor: colors.border, backgroundColor: !selectedEmpId ? colors.primary : colors.muted }]} onPress={() => setSelectedEmpId(undefined)}>
          <Text style={{ color: !selectedEmpId ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>All</Text>
        </TouchableOpacity>
        {employees?.map(e => (
          <TouchableOpacity key={e.id} style={[s.empChip, { borderColor: colors.border, backgroundColor: selectedEmpId === e.id ? colors.primary : colors.muted }]} onPress={() => setSelectedEmpId(selectedEmpId === e.id ? undefined : e.id)}>
            <Text style={{ color: selectedEmpId === e.id ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{e.name.split(" ")[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary / Detail toggle */}
      <View style={[s.viewToggle, { backgroundColor: colors.muted }]}>
        {(["summary", "detail"] as ViewMode[]).map(m => (
          <TouchableOpacity key={m} style={[s.toggleBtn, viewMode === m && { backgroundColor: colors.primary }]} onPress={() => setViewMode(m)}>
            <Text style={{ color: viewMode === m ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, textTransform: "capitalize" }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Grand total banner */}
      <View style={[s.grandTotal, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
        <View style={s.gtItem}>
          <Text style={[s.gtVal, { color: "#22C55E" }]}>R {grandTotal.toFixed(2)}</Text>
          <Text style={[s.gtLabel, { color: colors.mutedForeground }]}>Grand Total</Text>
        </View>
        {grandHours > 0 && (
          <View style={[s.gtItem, s.gtBorder, { borderColor: colors.border }]}>
            <Text style={[s.gtVal, { color: "#2563EB" }]}>{grandHours.toFixed(1)}h</Text>
            <Text style={[s.gtLabel, { color: colors.mutedForeground }]}>Hourly · R{hourlyTotal.toFixed(0)}</Text>
          </View>
        )}
        {grandMeters > 0 && (
          <View style={[s.gtItem, s.gtBorder, { borderColor: colors.border }]}>
            <Text style={[s.gtVal, { color: "#8B5CF6" }]}>{grandMeters.toFixed(0)}m</Text>
            <Text style={[s.gtLabel, { color: colors.mutedForeground }]}>Piece · R{pieceTotal.toFixed(0)}</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* ── SUMMARY MODE ── */}
        {viewMode === "summary" && (
          loadingSummary ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
          !summary?.length ? (
            <View style={s.empty}>
              <Feather name="dollar-sign" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No payroll data for this period</Text>
            </View>
          ) : (
            <>
              {/* Hourly section */}
              {summary.filter(r => Number(r.totalHours ?? 0) > 0).length > 0 && (
                <>
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: "#2563EB" }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>Hourly Workers</Text>
                    <Text style={[s.sectionAmount, { color: "#2563EB" }]}>R {hourlyTotal.toFixed(2)}</Text>
                  </View>
                  {/* Table header */}
                  <View style={[s.tableRow, s.tableHead, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[s.colEmp, s.headText, { color: colors.mutedForeground }]}>Employee</Text>
                    <Text style={[s.colHours, s.headText, { color: colors.mutedForeground }]}>Hours</Text>
                    <Text style={[s.colRate, s.headText, { color: colors.mutedForeground }]}>Rate</Text>
                    <Text style={[s.colAmt, s.headText, { color: colors.mutedForeground }]}>Amount</Text>
                  </View>
                  {summary.filter(r => Number(r.totalHours ?? 0) > 0).map(row => (
                    <View key={`h-${row.employeeId}`} style={[s.tableRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[s.colEmp, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{row.employeeName}</Text>
                      <Text style={[s.colHours, { color: colors.foreground }]}>{Number(row.totalHours).toFixed(1)}h</Text>
                      <Text style={[s.colRate, { color: colors.mutedForeground }]}>—</Text>
                      <Text style={[s.colAmt, { color: "#2563EB", fontFamily: "Inter_700Bold" }]}>R {Number((row as any).hourlyAmount ?? row.totalAmount).toFixed(2)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Piece work section */}
              {summary.filter(r => Number(r.totalMeters ?? 0) > 0).length > 0 && (
                <>
                  <View style={[s.sectionHeader, { marginTop: 20 }]}>
                    <View style={[s.sectionDot, { backgroundColor: "#8B5CF6" }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>Piece Workers</Text>
                    <Text style={[s.sectionAmount, { color: "#8B5CF6" }]}>R {pieceTotal.toFixed(2)}</Text>
                  </View>
                  <View style={[s.tableRow, s.tableHead, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[s.colEmp, s.headText, { color: colors.mutedForeground }]}>Employee</Text>
                    <Text style={[s.colHours, s.headText, { color: colors.mutedForeground }]}>Meters</Text>
                    <Text style={[s.colRate, s.headText, { color: colors.mutedForeground }]}>Rate</Text>
                    <Text style={[s.colAmt, s.headText, { color: colors.mutedForeground }]}>Amount</Text>
                  </View>
                  {summary.filter(r => Number(r.totalMeters ?? 0) > 0).map(row => (
                    <View key={`p-${row.employeeId}`} style={[s.tableRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[s.colEmp, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{row.employeeName}</Text>
                      <Text style={[s.colHours, { color: colors.foreground }]}>{Number(row.totalMeters).toFixed(0)}m</Text>
                      <Text style={[s.colRate, { color: colors.mutedForeground }]}>—</Text>
                      <Text style={[s.colAmt, { color: "#8B5CF6", fontFamily: "Inter_700Bold" }]}>R {Number((row as any).pieceAmount ?? row.totalAmount).toFixed(2)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Grand total row */}
              <View style={[s.tableRow, s.grandTotalRow, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                <Text style={[s.colEmp, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Grand Total</Text>
                <Text style={[s.colHours, { color: colors.foreground }]}> </Text>
                <Text style={[s.colRate, { color: colors.foreground }]}> </Text>
                <Text style={[s.colAmt, { color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 16 }]}>R {grandTotal.toFixed(2)}</Text>
              </View>
            </>
          )
        )}

        {/* ── DETAIL MODE ── */}
        {viewMode === "detail" && (
          loadingDetail ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
          !entries?.length ? (
            <View style={s.empty}><Feather name="list" size={40} color={colors.mutedForeground} /><Text style={[s.emptyText, { color: colors.mutedForeground }]}>No entries for this period</Text></View>
          ) : (
            <>
              {hourlyEntries.length > 0 && (
                <>
                  <View style={s.sectionHeader}>
                    <View style={[s.sectionDot, { backgroundColor: "#2563EB" }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>Hourly Workers</Text>
                  </View>
                  {hourlyEntries.map((e: any) => (
                    <View key={e.id} style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={s.detailRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.detailName, { color: colors.foreground }]}>{e.employee?.name ?? "Unknown"}</Text>
                          <Text style={[s.detailSub, { color: colors.mutedForeground }]}>{e.date} · {e.workType?.replace(/_/g, " ")}</Text>
                        </View>
                        <Text style={[s.detailAmt, { color: "#2563EB" }]}>R {Number(e.amountPayable ?? 0).toFixed(2)}</Text>
                      </View>
                      <View style={s.detailStats}>
                        <View style={s.detailStat}>
                          <Feather name="clock" size={11} color="#2563EB" />
                          <Text style={[s.detailStatText, { color: colors.mutedForeground }]}>{Number(e.hoursWorked ?? 0).toFixed(1)} hrs</Text>
                        </View>
                        {e.rateUsed && <View style={s.detailStat}><Text style={[s.detailStatText, { color: colors.mutedForeground }]}>@ R{e.rateUsed}/hr</Text></View>}
                        {e.clockIn && e.clockOut && <View style={s.detailStat}><Text style={[s.detailStatText, { color: colors.mutedForeground }]}>{e.clockIn}–{e.clockOut}</Text></View>}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {pieceEntries.length > 0 && (
                <>
                  <View style={[s.sectionHeader, { marginTop: hourlyEntries.length > 0 ? 20 : 0 }]}>
                    <View style={[s.sectionDot, { backgroundColor: "#8B5CF6" }]} />
                    <Text style={[s.sectionTitle, { color: colors.foreground }]}>Piece Workers</Text>
                  </View>
                  {pieceEntries.map((e: any) => {
                    const isOpen = e.status === "open";
                    return (
                      <View key={e.id} style={[s.detailCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={s.detailRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.detailName, { color: colors.foreground }]}>{e.employee?.name ?? "Unknown"}</Text>
                            <Text style={[s.detailSub, { color: colors.mutedForeground }]}>{e.date} · {e.workType?.replace(/_/g, " ")}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <Text style={[s.detailAmt, { color: isOpen ? colors.mutedForeground : "#8B5CF6" }]}>
                              {isOpen ? "R 0.00" : `R ${Number(e.amountPayable ?? 0).toFixed(2)}`}
                            </Text>
                            <View style={[s.statusBadge, { backgroundColor: isOpen ? "#F59E0B22" : "#22C55E22" }]}>
                              <Text style={{ color: isOpen ? "#F59E0B" : "#22C55E", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                                {isOpen ? "Open" : "Complete"}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={s.detailStats}>
                          {e.metersCompleted && <View style={s.detailStat}><Feather name="activity" size={11} color="#8B5CF6" /><Text style={[s.detailStatText, { color: colors.mutedForeground }]}>{e.metersCompleted}m</Text></View>}
                          {e.rateUsed && <View style={s.detailStat}><Text style={[s.detailStatText, { color: colors.mutedForeground }]}>@ R{e.rateUsed}/m</Text></View>}
                          {e.startChainage && e.endChainage && <View style={s.detailStat}><Text style={[s.detailStatText, { color: colors.mutedForeground }]}>{e.startChainage}–{e.endChainage}</Text></View>}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {/* Grand total */}
              <View style={[s.grandTotalRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
                <Text style={[s.gtLabel2, { color: colors.foreground }]}>Grand Total</Text>
                <Text style={[s.gtVal2, { color: "#22C55E" }]}>
                  R {entries.reduce((s: number, e: any) => s + Number(e.amountPayable ?? 0), 0).toFixed(2)}
                </Text>
              </View>
            </>
          )
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 14, borderBottomWidth: 1 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold" },
    filterRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 14, marginBottom: 10 },
    dateField: { flex: 1 },
    dateLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
    dateInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
    empFilterScroll: { marginBottom: 10 },
    empChip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1 },
    viewToggle: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: 10, padding: 4 },
    toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    grandTotal: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, padding: 14, gap: 16 },
    gtItem: { alignItems: "center", flex: 1 },
    gtBorder: { borderLeftWidth: 1, paddingLeft: 16 },
    gtVal: { fontFamily: "Inter_700Bold", fontSize: 18 },
    gtLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, flex: 1 },
    sectionAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
    tableRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 2 },
    tableHead: { marginBottom: 4 },
    headText: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase" },
    colEmp: { flex: 2, fontFamily: "Inter_400Regular", fontSize: 13 },
    colHours: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
    colRate: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center" },
    colAmt: { flex: 1.2, fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "right" },
    grandTotalRow: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    detailCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
    detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    detailName: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    detailSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    detailAmt: { fontFamily: "Inter_700Bold", fontSize: 15 },
    detailStats: { flexDirection: "row", gap: 12, marginTop: 8, flexWrap: "wrap" },
    detailStat: { flexDirection: "row", alignItems: "center", gap: 4 },
    detailStatText: { fontFamily: "Inter_400Regular", fontSize: 12 },
    statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    gtLabel2: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    gtVal2: { fontFamily: "Inter_700Bold", fontSize: 20 },
    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  });
}
