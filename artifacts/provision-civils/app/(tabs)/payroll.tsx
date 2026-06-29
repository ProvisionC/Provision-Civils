import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useGetPayrollSummary, useGetPayrollEntries, useListEmployees, getGetPayrollEntriesQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";

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

  const totalAmount = summary?.reduce((s, r) => s + (r.totalAmount ?? 0), 0) ?? 0;
  const totalHours = summary?.reduce((s, r) => s + (r.totalHours ?? 0), 0) ?? 0;
  const totalMeters = summary?.reduce((s, r) => s + (r.totalMeters ?? 0), 0) ?? 0;

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Payroll</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push("/labour/create" as any)}>
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={s.newBtnText}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      <View style={s.filterRow}>
        <View style={s.dateField}>
          <Text style={s.dateLabel}>From</Text>
          <TextInput style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
        </View>
        <View style={s.dateField}>
          <Text style={s.dateLabel}>To</Text>
          <TextInput style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.empFilterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <TouchableOpacity style={[s.empChip, !selectedEmpId && { backgroundColor: colors.primary }]} onPress={() => setSelectedEmpId(undefined)}>
          <Text style={{ color: !selectedEmpId ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>All</Text>
        </TouchableOpacity>
        {employees?.map(e => (
          <TouchableOpacity key={e.id} style={[s.empChip, selectedEmpId === e.id && { backgroundColor: colors.primary }]} onPress={() => setSelectedEmpId(selectedEmpId === e.id ? undefined : e.id)}>
            <Text style={{ color: selectedEmpId === e.id ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{e.name.split(" ")[0]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.viewToggle}>
        {(["summary", "detail"] as ViewMode[]).map(m => (
          <TouchableOpacity key={m} style={[s.toggleBtn, viewMode === m && { backgroundColor: colors.primary }]} onPress={() => setViewMode(m)}>
            <Text style={{ color: viewMode === m ? "#FFF" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 13, textTransform: "capitalize" }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.statsRow}>
        <StatCard label="Total Payable" value={`R ${totalAmount.toFixed(2)}`} icon="dollar-sign" colors={colors} accent={colors.primary} />
        <StatCard label="Total Hours" value={`${totalHours.toFixed(1)}h`} icon="clock" colors={colors} accent="#8B5CF6" />
        <StatCard label="Total Meters" value={`${totalMeters.toFixed(0)}m`} icon="activity" colors={colors} accent="#F59E0B" />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {viewMode === "summary" && (
          loadingSummary ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
          !summary?.length ? (
            <View style={s.empty}><Feather name="dollar-sign" size={40} color={colors.mutedForeground} /><Text style={[s.emptyText, { color: colors.mutedForeground }]}>No payroll data for this period</Text></View>
          ) : (
            summary.map(row => (
              <View key={row.employeeId} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardHeader}>
                  <View style={[s.avatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[s.avatarText, { color: colors.primary }]}>{row.employeeName?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cardName, { color: colors.foreground }]}>{row.employeeName}</Text>
                    <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{row.entryCount} entr{row.entryCount === 1 ? "y" : "ies"}</Text>
                  </View>
                  <Text style={[s.amount, { color: "#22C55E" }]}>R {Number(row.totalAmount).toFixed(2)}</Text>
                </View>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.cardStats}>
                  {Number(row.totalHours) > 0 && <Text style={[s.cardStat, { color: colors.mutedForeground }]}><Feather name="clock" size={12} /> {Number(row.totalHours).toFixed(1)} hrs</Text>}
                  {Number(row.totalMeters) > 0 && <Text style={[s.cardStat, { color: colors.mutedForeground }]}><Feather name="activity" size={12} /> {Number(row.totalMeters).toFixed(0)} m</Text>}
                </View>
              </View>
            ))
          )
        )}

        {viewMode === "detail" && (
          loadingDetail ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> :
          !entries?.length ? (
            <View style={s.empty}><Feather name="list" size={40} color={colors.mutedForeground} /><Text style={[s.emptyText, { color: colors.mutedForeground }]}>No entries for this period</Text></View>
          ) : (
            entries.map((e: any) => (
              <View key={e.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={[s.cardName, { color: colors.foreground }]}>{e.employee?.name ?? "Unknown"}</Text>
                    <Text style={[s.cardSub, { color: colors.mutedForeground }]}>{e.date} · {e.workType?.replace(/_/g, " ")}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {e.amountPayable ? <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 15 }}>R {Number(e.amountPayable).toFixed(2)}</Text> : null}
                    <View style={[s.badge, { backgroundColor: e.status === "complete" ? "#22C55E22" : colors.muted }]}>
                      <Text style={{ color: e.status === "complete" ? "#22C55E" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{e.status}</Text>
                    </View>
                  </View>
                </View>
                <View style={[s.divider, { backgroundColor: colors.border }]} />
                <View style={s.cardStats}>
                  {e.payrollType === "hourly" && e.hoursWorked && <Text style={[s.cardStat, { color: colors.mutedForeground }]}><Feather name="clock" size={12} /> {e.hoursWorked} hrs</Text>}
                  {e.payrollType === "piece_work" && e.metersCompleted && <Text style={[s.cardStat, { color: colors.mutedForeground }]}><Feather name="activity" size={12} /> {e.metersCompleted} m</Text>}
                  {e.rateUsed && <Text style={[s.cardStat, { color: colors.mutedForeground }]}>@ R{e.rateUsed}</Text>}
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, colors, accent }: { label: string; value: string; icon: any; colors: any; accent: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: "center", gap: 4 }}>
      <Feather name={icon} size={18} color={accent} />
      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground }}>{value}</Text>
      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
    title: { fontSize: 28, fontFamily: "Inter_700Bold", color: colors.foreground },
    newBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
    newBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    filterRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginBottom: 10 },
    dateField: { flex: 1 },
    dateLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 4 },
    dateInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: "Inter_400Regular" },
    empFilterScroll: { marginBottom: 10 },
    empChip: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border },
    viewToggle: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.muted, borderRadius: 10, padding: 4 },
    toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
    card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    avatarText: { fontFamily: "Inter_700Bold", fontSize: 16 },
    cardName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    cardSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    amount: { fontFamily: "Inter_700Bold", fontSize: 16 },
    divider: { height: 1, marginVertical: 10 },
    cardStats: { flexDirection: "row", gap: 16 },
    cardStat: { fontFamily: "Inter_400Regular", fontSize: 12 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
    empty: { alignItems: "center", paddingTop: 60, gap: 12 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  });
}
