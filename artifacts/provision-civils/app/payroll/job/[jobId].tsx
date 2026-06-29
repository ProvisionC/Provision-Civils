import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useGetPayrollSummary, useGetJob, getGetPayrollSummaryQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { usePdfExport } from "@/hooks/usePdfExport";

// ─── Payroll period helpers (26th → 25th cycle) ──────────────────────────────
function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtLabel(d: Date, showYear = false) {
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", ...(showYear ? { year: "numeric" } : {}) });
}
type PayrollPeriod = { key: string; label: string; start: string; end: string };
function buildPayrollPeriods(count = 6): PayrollPeriod[] {
  const today = new Date();
  const day   = today.getDate();
  const baseStartMonth = day >= 26 ? today.getMonth() : today.getMonth() - 1;
  const baseStartYear  = today.getFullYear() + Math.floor(baseStartMonth / 12);
  const normStartMonth = ((baseStartMonth % 12) + 12) % 12;
  const periods: PayrollPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const sMonth = ((normStartMonth - i) % 12 + 12) % 12;
    const sYear  = baseStartYear + Math.floor((normStartMonth - i) / 12);
    const eMonth = (sMonth + 1) % 12;
    const eYear  = sMonth === 11 ? sYear + 1 : sYear;
    const start  = fmt(new Date(sYear, sMonth, 26));
    const end    = fmt(new Date(eYear, eMonth, 25));
    const label  = i === 0
      ? `Current  (${fmtLabel(new Date(sYear, sMonth, 26))} – ${fmtLabel(new Date(eYear, eMonth, 25), true)})`
      : `${fmtLabel(new Date(sYear, sMonth, 26))} – ${fmtLabel(new Date(eYear, eMonth, 25), true)}`;
    periods.push({ key: start, label, start, end });
  }
  return periods;
}
type Period = "custom" | string;

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function JobPayrollCostScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { isExporting, exportPdf } = usePdfExport();

  const PERIODS = React.useMemo(() => buildPayrollPeriods(6), []);
  const [period, setPeriod]       = useState<Period>(PERIODS[0].key);
  const [customStart, setCustomStart] = useState(PERIODS[0].start);
  const [customEnd,   setCustomEnd]   = useState(PERIODS[0].end);

  const selectedPeriod = PERIODS.find(p => p.key === period);
  const startDate = period === "custom" ? customStart : (selectedPeriod?.start ?? PERIODS[0].start);
  const endDate   = period === "custom" ? customEnd   : (selectedPeriod?.end   ?? PERIODS[0].end);

  const jobIdNum = parseInt(jobId ?? "0", 10);

  const { data: job, isLoading: loadJob } = useGetJob(jobIdNum);
  const summaryParams = { startDate, endDate, jobId: jobIdNum };
  const { data: summary, isLoading: loadSum, isError, refetch } = useGetPayrollSummary(
    summaryParams,
    { query: { queryKey: getGetPayrollSummaryQueryKey(summaryParams) } },
  );

  const s = makeStyles(colors);

  if (user?.role !== "admin") {
    return (
      <View style={s.denied}>
        <Feather name="lock" size={52} color={colors.mutedForeground} />
        <Text style={[s.deniedTitle, { color: colors.foreground }]}>Admin Access Only</Text>
      </View>
    );
  }

  const isLoading  = loadJob || loadSum;
  const rows       = summary ?? [];
  const totalCost  = rows.reduce((s, r) => s + r.totalAmount, 0);
  const totalHours = rows.reduce((s, r) => s + r.totalHours, 0);
  const totalMeters = rows.reduce((s, r) => s + r.totalMeters, 0);

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]} numberOfLines={1}>
            {loadJob ? "Loading…" : ((job as any)?.jobNumber ?? "Job Payroll Cost")}
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            {loadJob ? "" : ((job as any)?.projectName ?? "Payroll Cost Report")}
          </Text>
        </View>
        {isExporting && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
        <TouchableOpacity
          style={[s.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
          onPress={() => exportPdf({
            endpoint: `/api/payroll/pdf/job/${jobIdNum}?startDate=${startDate}&endDate=${endDate}`,
            filename: `Payroll-Job-${(job as any)?.jobNumber ?? jobIdNum}-${startDate}-${endDate}.pdf`,
          })}
          disabled={isExporting || !rows.length}
        >
          <Feather name="file-text" size={15} color="#FFF" />
          <Text style={s.exportBtnText}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {/* ── Period selector ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.periodScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
      >
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[s.periodChip, {
              backgroundColor: period === p.key ? colors.primary : colors.muted,
              borderColor: period === p.key ? colors.primary : colors.border,
            }]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodChipText, { color: period === p.key ? "#FFF" : colors.foreground }]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[s.periodChip, {
            backgroundColor: period === "custom" ? colors.primary : colors.muted,
            borderColor: period === "custom" ? colors.primary : colors.border,
          }]}
          onPress={() => setPeriod("custom")}
        >
          <Feather name="calendar" size={13} color={period === "custom" ? "#FFF" : colors.foreground} />
          <Text style={[s.periodChipText, { color: period === "custom" ? "#FFF" : colors.foreground }]}>Custom</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Custom date inputs ── */}
      {period === "custom" && (
        <View style={[s.dateRow, { borderBottomColor: colors.border }]}>
          <View style={s.dateField}>
            <Text style={[s.dateLabel, { color: colors.mutedForeground }]}>From</Text>
            <TextInput
              style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={customStart} onChangeText={setCustomStart}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={{ width: 20 }} />
          <View style={s.dateField}>
            <Text style={[s.dateLabel, { color: colors.mutedForeground }]}>To</Text>
            <TextInput
              style={[s.dateInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={customEnd} onChangeText={setCustomEnd}
              placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>
      )}

      {/* ── Active period bar ── */}
      <View style={[s.activePeriod, { backgroundColor: colors.primary + "12", borderBottomColor: colors.border }]}>
        <Feather name="calendar" size={13} color={colors.primary} />
        <Text style={[s.activePeriodText, { color: colors.primary }]}>{startDate}  →  {endDate}</Text>
        <TouchableOpacity onPress={() => refetch()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="refresh-cw" size={13} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadText, { color: colors.mutedForeground }]}>Loading payroll…</Text>
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={40} color="#EF4444" />
          <Text style={[s.loadText, { color: "#EF4444" }]}>Failed to load payroll data</Text>
          <TouchableOpacity style={[s.retryBtn, { borderColor: colors.border }]} onPress={() => refetch()}>
            <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !rows.length ? (
        <View style={s.center}>
          <Feather name="dollar-sign" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Payroll Data</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            No completed labour entries for this job in this period.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* ── Employee labour cost rows ── */}
          {rows.map((row, idx) => (
            <View
              key={row.employeeId ?? idx}
              style={[s.empCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={s.empCardHeader}>
                <View style={[s.avatar, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[s.avatarText, { color: colors.primary }]}>
                    {(row.employeeName ?? "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.empName, { color: colors.foreground }]}>{row.employeeName}</Text>
                  <View style={s.empMeta}>
                    <Text style={[s.empMetaText, { color: colors.mutedForeground }]}>Emp# {row.employeeNumber ?? "—"}</Text>
                    <Text style={[s.empMetaDot, { color: colors.mutedForeground }]}>·</Text>
                    <Text style={[s.empMetaText, { color: colors.mutedForeground }]}>Clock {row.clockNumber ?? "—"}</Text>
                  </View>
                </View>
                <View style={s.grossBadge}>
                  <Text style={[s.grossLabel, { color: colors.mutedForeground }]}>Labour Cost</Text>
                  <Text style={[s.grossValue, { color: "#22C55E" }]}>R {row.totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              <View style={[s.cardDivider, { backgroundColor: colors.border }]} />

              <View style={s.breakdownRow}>
                {row.totalHours > 0 && (
                  <View style={[s.breakdownItem, { backgroundColor: "#2563EB10" }]}>
                    <Feather name="clock" size={13} color="#2563EB" />
                    <Text style={[s.breakdownLabel, { color: "#2563EB" }]}>Hourly</Text>
                    <Text style={[s.breakdownVal, { color: colors.foreground }]}>{row.totalHours.toFixed(1)} h</Text>
                    <Text style={[s.breakdownAmount, { color: "#2563EB" }]}>R {row.hourlyAmount.toFixed(2)}</Text>
                  </View>
                )}
                {row.totalMeters > 0 && (
                  <View style={[s.breakdownItem, { backgroundColor: "#8B5CF610" }]}>
                    <Feather name="activity" size={13} color="#8B5CF6" />
                    <Text style={[s.breakdownLabel, { color: "#8B5CF6" }]}>Piece Work</Text>
                    <Text style={[s.breakdownVal, { color: colors.foreground }]}>{row.totalMeters.toFixed(0)} m</Text>
                    <Text style={[s.breakdownAmount, { color: "#8B5CF6" }]}>R {row.pieceAmount.toFixed(2)}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Fixed totals footer ── */}
      {!!rows.length && (
        <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={s.footerRow}>
            <View style={s.footerStat}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Workers</Text>
              <Text style={[s.footerStatValue, { color: colors.foreground }]}>{rows.length}</Text>
            </View>
            {totalHours > 0 && (
              <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
                <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Total Hours</Text>
                <Text style={[s.footerStatValue, { color: "#2563EB" }]}>{totalHours.toFixed(1)} h</Text>
              </View>
            )}
            {totalMeters > 0 && (
              <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
                <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Total Meters</Text>
                <Text style={[s.footerStatValue, { color: "#8B5CF6" }]}>{totalMeters.toFixed(0)} m</Text>
              </View>
            )}
            <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Labour Cost</Text>
              <Text style={[s.footerStatValue, { color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 16 }]}>
                R {totalCost.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: colors.background },
    denied:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
    deniedTitle: { fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 8 },

    header:    { flexDirection: "row", alignItems: "center", gap: 10,
                 paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1 },
    backBtn:   { padding: 4 },
    title:     { fontFamily: "Inter_700Bold", fontSize: 18 },
    subtitle:  { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
    exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10,
                 paddingHorizontal: 12, paddingVertical: 9 },
    exportBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },

    periodScroll:   { borderBottomWidth: 1 },
    periodChip:     { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, borderWidth: 1,
                      paddingHorizontal: 14, paddingVertical: 7 },
    periodChipText: { fontFamily: "Inter_600SemiBold", fontSize: 12.5 },

    dateRow:   { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
                 paddingBottom: 12, borderBottomWidth: 1 },
    dateField: { flex: 1 },
    dateLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 4 },
    dateInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
                 fontFamily: "Inter_400Regular", fontSize: 13 },

    activePeriod:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16,
                        paddingVertical: 8, borderBottomWidth: 1 },
    activePeriodText: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },

    center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
    loadText:   { fontFamily: "Inter_400Regular", fontSize: 14 },
    retryBtn:   { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
    emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 },
    emptyText:  { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },

    empCard:       { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
    empCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
    avatar:        { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    avatarText:    { fontFamily: "Inter_700Bold", fontSize: 16 },
    empName:       { fontFamily: "Inter_700Bold", fontSize: 15 },
    empMeta:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    empMetaText:   { fontFamily: "Inter_400Regular", fontSize: 12 },
    empMetaDot:    { fontFamily: "Inter_400Regular", fontSize: 12 },
    grossBadge:    { alignItems: "flex-end" },
    grossLabel:    { fontFamily: "Inter_400Regular", fontSize: 11 },
    grossValue:    { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 },

    cardDivider:   { height: 1, marginBottom: 10 },
    breakdownRow:  { flexDirection: "row", gap: 8 },
    breakdownItem: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
    breakdownLabel:{ fontFamily: "Inter_600SemiBold", fontSize: 12 },
    breakdownVal:  { fontFamily: "Inter_400Regular", fontSize: 11 },
    breakdownAmount:{ fontFamily: "Inter_700Bold", fontSize: 15, marginTop: 2 },

    footer:          { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 30 },
    footerRow:       { flexDirection: "row", gap: 0 },
    footerStat:      { flex: 1, alignItems: "center" },
    footerStatBorder:{ borderLeftWidth: 1 },
    footerStatLabel: { fontFamily: "Inter_400Regular", fontSize: 10, marginBottom: 3 },
    footerStatValue: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  });
}
