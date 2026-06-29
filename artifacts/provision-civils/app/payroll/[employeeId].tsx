import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, Share, Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import {
  useGetPayrollSummary, useGetPayrollEntries,
  getGetPayrollSummaryQueryKey, getGetPayrollEntriesQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

// ─── Print/share for one employee ────────────────────────────────────────────
function buildEmployeePrintHTML(
  emp: { name: string; employeeNumber?: string | null; clockNumber?: string | null },
  summary: { totalHours: number; hourlyAmount: number; metersAt25: number; metersAt30: number; totalMeters: number; pieceAmount: number; totalAmount: number },
  entries: any[],
  startDate: string,
  endDate: string,
): string {
  const hourlyEntries = entries.filter(e => e.payrollType === "hourly");
  const pieceEntries  = entries.filter(e => e.payrollType === "piece_work");

  const hourlyRows = hourlyEntries.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.clockIn ?? "—"} – ${e.clockOut ?? "—"}</td>
      <td>${e.hoursWorked ? Number(e.hoursWorked).toFixed(2) + " h" : "—"}</td>
      <td>${e.rateUsed ? "R " + e.rateUsed + "/hr" : "—"}</td>
      <td class="highlight">R ${e.amountPayable ? Number(e.amountPayable).toFixed(2) : "0.00"}</td>
    </tr>`).join("");

  const pieceRows = pieceEntries.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.metersCompleted ? Number(e.metersCompleted).toFixed(0) + " m" : "—"}</td>
      <td>${e.rateUsed ? "R " + e.rateUsed + "/m" : "—"}</td>
      <td>${e.status === "complete" ? "Complete" : "Open"}</td>
      <td class="highlight">R ${e.amountPayable ? Number(e.amountPayable).toFixed(2) : "0.00"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Payroll – ${emp.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .header { background: #1565C0; color: #fff; padding: 20px 24px 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .header .sub { font-size: 12px; opacity: 0.85; margin-top: 4px; }
  .orange { color: #FF6F00; }
  .body { padding: 20px 24px; }
  .emp-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f0f5ff;
    border: 1px solid #dde3ef; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
  .emp-info .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 3px; }
  .emp-info .value { font-size: 13px; font-weight: 700; color: #1565C0; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    color: #1565C0; border-bottom: 2px solid #1565C0; padding-bottom: 4px; margin: 14px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-bottom: 16px; }
  th { background: #1565C0; color: #fff; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.4px; }
  td { padding: 7px 8px; border-bottom: 1px solid #e8ecf0; }
  tr:nth-child(even) td { background: #f5f8ff; }
  td.highlight { font-weight: 700; color: #1565C0; }
  .totals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
  .total-box { border: 1px solid #dde3ef; border-radius: 8px; padding: 12px 14px; }
  .total-box .label { font-size: 9.5px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  .total-box .value { font-size: 16px; font-weight: 700; color: #1565C0; }
  .total-box.grand { background: #1565C0; border-color: #1565C0; }
  .total-box.grand .label { color: #93c5fd; }
  .total-box.grand .value { color: #FF6F00; font-size: 20px; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #dde3ef;
    font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    .header, th, tr:nth-child(even) td, .total-box.grand { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>PROVISION <span class="orange">CIVILS</span></h1>
    <div class="sub">Individual Payroll Summary</div>
  </div>
  <div style="text-align:right;font-size:11px;opacity:.9;">
    <div><strong>Period:</strong> ${startDate} to ${endDate}</div>
    <div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-ZA", { dateStyle: "medium" })}</div>
  </div>
</div>

<div class="body">
  <div class="section-title">Employee Details</div>
  <div class="emp-info">
    <div><div class="label">Full Name</div><div class="value">${emp.name}</div></div>
    <div><div class="label">Employee Number</div><div class="value">${emp.employeeNumber ?? "—"}</div></div>
    <div><div class="label">Clock Number</div><div class="value">${emp.clockNumber ?? "—"}</div></div>
    <div><div class="label">Report Period</div><div class="value">${startDate} – ${endDate}</div></div>
  </div>

  ${hourlyRows ? `
  <div class="section-title">Hourly Labour Entries</div>
  <table>
    <thead><tr><th>Date</th><th>Clock In/Out</th><th>Hours</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${hourlyRows}</tbody>
  </table>` : ""}

  ${pieceRows ? `
  <div class="section-title">Piece Work Entries</div>
  <table>
    <thead><tr><th>Date</th><th>Meters</th><th>Rate</th><th>Status</th><th>Amount</th></tr></thead>
    <tbody>${pieceRows}</tbody>
  </table>` : ""}

  <div class="section-title">Earnings Summary</div>
  <div class="totals">
    <div class="total-box"><div class="label">Hourly Earnings</div><div class="value">R ${summary.hourlyAmount.toFixed(2)}</div></div>
    <div class="total-box"><div class="label">Piece Work Earnings</div><div class="value">R ${summary.pieceAmount.toFixed(2)}</div></div>
    <div class="total-box grand"><div class="label">Total Gross Pay</div><div class="value">R ${summary.totalAmount.toFixed(2)}</div></div>
  </div>

  <div class="footer">
    <span>Provision Civils (Pty) Ltd — Confidential Payroll Document</span>
    <span>Printed: ${new Date().toLocaleString("en-ZA")}</span>
  </div>
</div>
</body>
</html>`;
}

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

  const handlePrint = useCallback(async () => {
    if (!summary) { Alert.alert("No Data", "No payroll data to print."); return; }
    const html = buildEmployeePrintHTML(
      { name: summary.employeeName, employeeNumber: summary.employeeNumber, clockNumber: summary.clockNumber },
      summary,
      entries ?? [],
      startDate,
      endDate,
    );
    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
    } else {
      const lines = [
        "PROVISION CIVILS – INDIVIDUAL PAYROLL SUMMARY",
        `Employee: ${summary.employeeName}`,
        `Emp#: ${summary.employeeNumber ?? "—"}   Clock#: ${summary.clockNumber ?? "—"}`,
        `Period: ${startDate} to ${endDate}`,
        "─".repeat(50),
        "",
        summary.totalHours > 0 ? `Hourly Hours:   ${summary.totalHours.toFixed(2)} h` : "",
        summary.totalHours > 0 ? `Hourly Pay:     R ${summary.hourlyAmount.toFixed(2)}` : "",
        summary.metersAt25 > 0 ? `Meters @ R25:   ${summary.metersAt25.toFixed(0)} m` : "",
        summary.metersAt30 > 0 ? `Meters @ R30:   ${summary.metersAt30.toFixed(0)} m` : "",
        summary.totalMeters > 0 ? `Piece Work Pay: R ${summary.pieceAmount.toFixed(2)}` : "",
        "",
        `TOTAL GROSS PAY: R ${summary.totalAmount.toFixed(2)}`,
        "",
        `Generated: ${new Date().toLocaleString("en-ZA")}`,
      ].filter(l => l !== "").join("\n");
      await Share.share({ title: `Payroll – ${summary.employeeName}`, message: lines });
    }
  }, [summary, entries, startDate, endDate]);

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
        <TouchableOpacity
          style={[s.printBtn, { backgroundColor: colors.primary }]}
          onPress={handlePrint}
        >
          <Feather name="printer" size={15} color="#FFF" />
          <Text style={s.printBtnText}>Print</Text>
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
