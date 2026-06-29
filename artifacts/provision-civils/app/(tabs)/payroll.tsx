import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Platform, Share, Alert,
} from "react-native";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useGetPayrollSummary, useGetPayrollEntries, getGetPayrollSummaryQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";

// ─── Date helpers ────────────────────────────────────────────────────────────
function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekRange() {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);   sun.setDate(mon.getDate() + 6);
  return { start: fmt(mon), end: fmt(sun) };
}
function monthRange() {
  const t = new Date();
  return {
    start: fmt(new Date(t.getFullYear(), t.getMonth(), 1)),
    end:   fmt(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
  };
}

type Period = "week" | "month" | "custom";

// ─── CSV generator ───────────────────────────────────────────────────────────
function buildCSV(rows: any[], startDate: string, endDate: string): string {
  const headers = [
    "Employee Name", "Employee Number", "Clock Number",
    "Hours Worked", "Hourly Pay (R)",
    "Meters @ R25", "Meters @ R30", "Total Meters",
    "Piece Work Pay (R)", "Gross Pay (R)",
  ];
  const totals = {
    hours:  rows.reduce((s, r) => s + r.totalHours, 0),
    hourly: rows.reduce((s, r) => s + r.hourlyAmount, 0),
    m25:    rows.reduce((s, r) => s + r.metersAt25, 0),
    m30:    rows.reduce((s, r) => s + r.metersAt30, 0),
    meters: rows.reduce((s, r) => s + r.totalMeters, 0),
    piece:  rows.reduce((s, r) => s + r.pieceAmount, 0),
    gross:  rows.reduce((s, r) => s + r.totalAmount, 0),
  };
  const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    [`"PROVISION CIVILS – PAYROLL REPORT"`, `"Period: ${startDate} to ${endDate}"`],
    [],
    headers.map(q),
    ...rows.map(r => [
      q(r.employeeName), q(r.employeeNumber ?? ""), q(r.clockNumber ?? ""),
      q(r.totalHours.toFixed(2)), q(r.hourlyAmount.toFixed(2)),
      q(r.metersAt25.toFixed(0)), q(r.metersAt30.toFixed(0)),
      q(r.totalMeters.toFixed(0)),
      q(r.pieceAmount.toFixed(2)), q(r.totalAmount.toFixed(2)),
    ]),
    [],
    [q("TOTAL"), q(""), q(""),
     q(totals.hours.toFixed(2)), q(totals.hourly.toFixed(2)),
     q(totals.m25.toFixed(0)), q(totals.m30.toFixed(0)), q(totals.meters.toFixed(0)),
     q(totals.piece.toFixed(2)), q(totals.gross.toFixed(2))],
  ];
  return lines.map(row => row.join(",")).join("\n");
}

// ─── HTML/Print generator ────────────────────────────────────────────────────
function buildPrintHTML(rows: any[], startDate: string, endDate: string): string {
  const totalEmployees = rows.length;
  const grandHourly = rows.reduce((s, r) => s + r.hourlyAmount, 0);
  const grandPiece  = rows.reduce((s, r) => s + r.pieceAmount, 0);
  const grandTotal  = rows.reduce((s, r) => s + r.totalAmount, 0);
  const employeeRows = rows.map(r => `
    <tr>
      <td>${r.employeeName}</td>
      <td>${r.employeeNumber ?? "—"}</td>
      <td>${r.clockNumber ?? "—"}</td>
      <td>${r.totalHours > 0 ? r.totalHours.toFixed(1) + " h" : "—"}</td>
      <td>${r.hourlyAmount > 0 ? "R " + r.hourlyAmount.toFixed(2) : "—"}</td>
      <td>${r.metersAt25 > 0 ? r.metersAt25.toFixed(0) + " m" : "—"}</td>
      <td>${r.metersAt30 > 0 ? r.metersAt30.toFixed(0) + " m" : "—"}</td>
      <td>${r.totalMeters > 0 ? r.totalMeters.toFixed(0) + " m" : "—"}</td>
      <td>${r.pieceAmount > 0 ? "R " + r.pieceAmount.toFixed(2) : "—"}</td>
      <td class="highlight">R ${r.totalAmount.toFixed(2)}</td>
    </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Provision Civils – Payroll Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; }
  .header { background: #1565C0; color: #fff; padding: 20px 24px 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .header h1 { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
  .header .sub { font-size: 12px; opacity: 0.85; margin-top: 4px; }
  .header .period { text-align: right; font-size: 11px; opacity: 0.9; }
  .orange { color: #FF6F00; }
  .body { padding: 20px 24px; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;
    color: #1565C0; border-bottom: 2px solid #1565C0; padding-bottom: 4px; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { background: #1565C0; color: #fff; padding: 7px 8px; text-align: left; font-weight: 600; font-size: 9.5px;
    text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
  td { padding: 7px 8px; border-bottom: 1px solid #e8ecf0; vertical-align: middle; }
  tr:nth-child(even) td { background: #f5f8ff; }
  td.highlight { font-weight: 700; color: #1565C0; }
  .totals { margin-top: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .total-box { border: 1px solid #dde3ef; border-radius: 8px; padding: 12px 14px; }
  .total-box .label { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
  .total-box .value { font-size: 17px; font-weight: 700; color: #1565C0; }
  .total-box.grand .value { color: #15803d; font-size: 20px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #dde3ef;
    font-size: 9.5px; color: #94a3b8; display: flex; justify-content: space-between; }
  @media print {
    .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .total-box { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>PROVISION <span class="orange">CIVILS</span></h1>
    <div class="sub">Payroll Report</div>
  </div>
  <div class="period">
    <div><strong>Period:</strong> ${startDate} to ${endDate}</div>
    <div><strong>Generated:</strong> ${new Date().toLocaleDateString("en-ZA", { dateStyle: "medium" })}</div>
  </div>
</div>

<div class="body">
  <div class="section-title">Employee Payroll Summary</div>
  <table>
    <thead>
      <tr>
        <th>Employee Name</th><th>Emp #</th><th>Clock #</th>
        <th>Hours</th><th>Hourly Pay</th>
        <th>Meters @ R25</th><th>Meters @ R30</th><th>Total Meters</th>
        <th>Piece Pay</th><th>Gross Pay</th>
      </tr>
    </thead>
    <tbody>
      ${employeeRows}
      <tr style="background:#1565C0 !important;">
        <td colspan="3" style="color:#fff;font-weight:700;background:#1565C0">TOTAL (${totalEmployees} employees)</td>
        <td style="color:#fff;background:#1565C0">—</td>
        <td style="color:#fff;font-weight:700;background:#1565C0">R ${grandHourly.toFixed(2)}</td>
        <td colspan="3" style="background:#1565C0"></td>
        <td style="color:#fff;font-weight:700;background:#1565C0">R ${grandPiece.toFixed(2)}</td>
        <td style="color:#FF6F00;font-weight:700;font-size:12px;background:#1565C0">R ${grandTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div class="total-box"><div class="label">Total Employees</div><div class="value">${totalEmployees}</div></div>
    <div class="total-box"><div class="label">Total Hourly Payroll</div><div class="value">R ${grandHourly.toFixed(2)}</div></div>
    <div class="total-box"><div class="label">Total Piece Work Payroll</div><div class="value">R ${grandPiece.toFixed(2)}</div></div>
    <div class="total-box grand"><div class="label">Grand Total Payroll</div><div class="value">R ${grandTotal.toFixed(2)}</div></div>
  </div>

  <div class="footer">
    <span>Provision Civils (Pty) Ltd — Confidential Payroll Document</span>
    <span>Printed: ${new Date().toLocaleString("en-ZA")}</span>
  </div>
</div>
</body>
</html>`;
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PayrollScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [period, setPeriod] = useState<Period>("month");
  const [customStart, setCustomStart] = useState(() => monthRange().start);
  const [customEnd,   setCustomEnd]   = useState(() => monthRange().end);

  const { start: wStart, end: wEnd } = weekRange();
  const { start: mStart, end: mEnd } = monthRange();

  const startDate = period === "week" ? wStart : period === "month" ? mStart : customStart;
  const endDate   = period === "week" ? wEnd   : period === "month" ? mEnd   : customEnd;

  const { data: summary, isLoading, isError, refetch } = useGetPayrollSummary(
    { startDate, endDate },
    { query: { queryKey: getGetPayrollSummaryQueryKey({ startDate, endDate }) } },
  );

  const s = makeStyles(colors);

  // Admin-only guard
  if (user?.role !== "admin") {
    return (
      <View style={s.denied}>
        <Feather name="lock" size={52} color={colors.mutedForeground} />
        <Text style={[s.deniedTitle, { color: colors.foreground }]}>Admin Access Only</Text>
        <Text style={[s.deniedSub, { color: colors.mutedForeground }]}>
          The Payroll module is restricted to administrators.
        </Text>
      </View>
    );
  }

  // Derived totals
  const totalEmployees = summary?.length ?? 0;
  const grandHourly    = summary?.reduce((s, r) => s + r.hourlyAmount, 0) ?? 0;
  const grandPiece     = summary?.reduce((s, r) => s + r.pieceAmount,  0) ?? 0;
  const grandTotal     = summary?.reduce((s, r) => s + r.totalAmount,  0) ?? 0;

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(async () => {
    if (!summary?.length) { Alert.alert("No Data", "No payroll data to export for this period."); return; }
    const csv = buildCSV(summary, startDate, endDate);
    const filename = `payroll_${startDate}_${endDate}.csv`;

    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ title: filename, message: csv });
    }
  }, [summary, startDate, endDate]);

  // ── Print / PDF ────────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    if (!summary?.length) { Alert.alert("No Data", "No payroll data to print for this period."); return; }
    const html = buildPrintHTML(summary, startDate, endDate);

    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); }
    } else {
      // Native: share as formatted text report
      const lines = [
        "PROVISION CIVILS – PAYROLL REPORT",
        `Period: ${startDate} to ${endDate}`,
        "─".repeat(60),
        "",
        ...(summary ?? []).map(r =>
          `${r.employeeName.padEnd(25)} Emp#: ${(r.employeeNumber ?? "—").padEnd(8)} Clock: ${r.clockNumber ?? "—"}\n` +
          (r.totalHours > 0 ? `  Hourly: ${r.totalHours.toFixed(1)}h = R ${r.hourlyAmount.toFixed(2)}\n` : "") +
          (r.totalMeters > 0
            ? `  Piece: ${r.metersAt25 > 0 ? `${r.metersAt25.toFixed(0)}m@R25 ` : ""}${r.metersAt30 > 0 ? `${r.metersAt30.toFixed(0)}m@R30 ` : ""}= R ${r.pieceAmount.toFixed(2)}\n`
            : "") +
          `  GROSS PAY: R ${r.totalAmount.toFixed(2)}`
        ),
        "",
        "─".repeat(60),
        `Total Employees    : ${totalEmployees}`,
        `Total Hourly       : R ${grandHourly.toFixed(2)}`,
        `Total Piece Work   : R ${grandPiece.toFixed(2)}`,
        `GRAND TOTAL        : R ${grandTotal.toFixed(2)}`,
        "",
        `Generated: ${new Date().toLocaleString("en-ZA")}`,
      ];
      await Share.share({ title: `Payroll Report ${startDate} to ${endDate}`, message: lines.join("\n") });
    }
  }, [summary, startDate, endDate, totalEmployees, grandHourly, grandPiece, grandTotal]);

  return (
    <View style={s.container}>
      {/* ── Header ── */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[s.title, { color: colors.foreground }]}>Payroll</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Admin · Payroll Report</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={handleExportCSV}
          >
            <Feather name="file-text" size={15} color={colors.foreground} />
            <Text style={[s.actionBtnText, { color: colors.foreground }]}>Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handlePrint}
          >
            <Feather name="printer" size={15} color="#FFF" />
            <Text style={[s.actionBtnText, { color: "#FFF" }]}>Print</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Period selector ── */}
      <View style={[s.periodRow, { backgroundColor: colors.muted }]}>
        {(["week", "month", "custom"] as Period[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[s.periodBtn, period === p && { backgroundColor: colors.card }]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.periodBtnText, { color: period === p ? colors.primary : colors.mutedForeground }]}>
              {p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          <View style={s.dateSep} />
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

      {/* ── Active period label ── */}
      <View style={[s.activePeriod, { backgroundColor: colors.primary + "12", borderBottomColor: colors.border }]}>
        <Feather name="calendar" size={13} color={colors.primary} />
        <Text style={[s.activePeriodText, { color: colors.primary }]}>
          {startDate}  →  {endDate}
        </Text>
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
            <Text style={[s.retryText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !summary?.length ? (
        <View style={s.center}>
          <Feather name="dollar-sign" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No Payroll Data</Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            No completed labour entries found for this period.
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 200 }}>
          {/* Per-employee cards */}
          {summary.map(row => (
            <TouchableOpacity
              key={row.employeeId}
              style={[s.empCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/payroll/${row.employeeId}?startDate=${startDate}&endDate=${endDate}` as any)}
              activeOpacity={0.7}
            >
              {/* Card header */}
              <View style={s.empCardHeader}>
                <View style={[s.avatar, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[s.avatarText, { color: colors.primary }]}>
                    {row.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.empName, { color: colors.foreground }]}>{row.employeeName}</Text>
                  <View style={s.empMeta}>
                    <Text style={[s.empMetaText, { color: colors.mutedForeground }]}>
                      Emp# {row.employeeNumber ?? "—"}
                    </Text>
                    <Text style={[s.empMetaDot, { color: colors.mutedForeground }]}>·</Text>
                    <Text style={[s.empMetaText, { color: colors.mutedForeground }]}>
                      Clock {row.clockNumber ?? "—"}
                    </Text>
                  </View>
                </View>
                <View style={s.grossBadge}>
                  <Text style={[s.grossLabel, { color: colors.mutedForeground }]}>Gross Pay</Text>
                  <Text style={[s.grossValue, { color: "#22C55E" }]}>R {row.totalAmount.toFixed(2)}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={[s.cardDivider, { backgroundColor: colors.border }]} />

              {/* Hourly block */}
              {row.totalHours > 0 && (
                <View style={[s.payBlock, { backgroundColor: "#2563EB10", borderColor: "#2563EB30" }]}>
                  <View style={s.payBlockHeader}>
                    <View style={[s.payDot, { backgroundColor: "#2563EB" }]} />
                    <Text style={[s.payBlockTitle, { color: "#2563EB" }]}>Hourly</Text>
                  </View>
                  <View style={s.payStats}>
                    <View style={s.payStat}>
                      <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>Hours</Text>
                      <Text style={[s.payStatValue, { color: colors.foreground }]}>{row.totalHours.toFixed(1)} h</Text>
                    </View>
                    <View style={s.payStat}>
                      <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>Rate</Text>
                      <Text style={[s.payStatValue, { color: colors.foreground }]}>R25/hr</Text>
                    </View>
                    <View style={s.payStat}>
                      <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>Hourly Pay</Text>
                      <Text style={[s.payStatValue, { color: "#2563EB", fontFamily: "Inter_700Bold" }]}>R {row.hourlyAmount.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Piece work block */}
              {row.totalMeters > 0 && (
                <View style={[s.payBlock, { backgroundColor: "#8B5CF610", borderColor: "#8B5CF630", marginTop: row.totalHours > 0 ? 8 : 0 }]}>
                  <View style={s.payBlockHeader}>
                    <View style={[s.payDot, { backgroundColor: "#8B5CF6" }]} />
                    <Text style={[s.payBlockTitle, { color: "#8B5CF6" }]}>Piece Work</Text>
                  </View>
                  <View style={s.payStats}>
                    {row.metersAt25 > 0 && (
                      <View style={s.payStat}>
                        <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>@ R25/m</Text>
                        <Text style={[s.payStatValue, { color: colors.foreground }]}>{row.metersAt25.toFixed(0)} m</Text>
                      </View>
                    )}
                    {row.metersAt30 > 0 && (
                      <View style={s.payStat}>
                        <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>@ R30/m</Text>
                        <Text style={[s.payStatValue, { color: colors.foreground }]}>{row.metersAt30.toFixed(0)} m</Text>
                      </View>
                    )}
                    <View style={s.payStat}>
                      <Text style={[s.payStatLabel, { color: colors.mutedForeground }]}>Total ({row.totalMeters.toFixed(0)} m)</Text>
                      <Text style={[s.payStatValue, { color: "#8B5CF6", fontFamily: "Inter_700Bold" }]}>R {row.pieceAmount.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Tap hint */}
              <View style={s.cardHint}>
                <Text style={[s.cardHintText, { color: colors.mutedForeground }]}>View detailed report</Text>
                <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Fixed totals footer ── */}
      {!!summary?.length && (
        <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={s.footerRow}>
            <View style={s.footerStat}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Employees</Text>
              <Text style={[s.footerStatValue, { color: colors.foreground }]}>{totalEmployees}</Text>
            </View>
            <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Hourly Total</Text>
              <Text style={[s.footerStatValue, { color: "#2563EB" }]}>R {grandHourly.toFixed(2)}</Text>
            </View>
            <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Piece Work</Text>
              <Text style={[s.footerStatValue, { color: "#8B5CF6" }]}>R {grandPiece.toFixed(2)}</Text>
            </View>
            <View style={[s.footerStat, s.footerStatBorder, { borderColor: colors.border }]}>
              <Text style={[s.footerStatLabel, { color: colors.mutedForeground }]}>Grand Total</Text>
              <Text style={[s.footerStatValue, { color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 16 }]}>R {grandTotal.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container:  { flex: 1, backgroundColor: colors.background },
    denied:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 },
    deniedTitle:{ fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 8 },
    deniedSub:  { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },

    header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                     paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1 },
    title:         { fontFamily: "Inter_700Bold", fontSize: 26 },
    subtitle:      { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8 },
    actionBtn:     { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10,
                     paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
    actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

    periodRow:     { flexDirection: "row", margin: 12, borderRadius: 12, padding: 4 },
    periodBtn:     { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
    periodBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },

    dateRow:    { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16,
                  paddingBottom: 12, borderBottomWidth: 1 },
    dateField:  { flex: 1 },
    dateLabel:  { fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 4 },
    dateInput:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
                  fontFamily: "Inter_400Regular", fontSize: 13 },
    dateSep:    { width: 20, height: 1, backgroundColor: "transparent" },

    activePeriod:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16,
                        paddingVertical: 8, borderBottomWidth: 1 },
    activePeriodText: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },

    center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 40 },
    loadText:  { fontFamily: "Inter_400Regular", fontSize: 14 },
    retryBtn:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
    retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    emptyTitle:{ fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 8 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },

    empCard:       { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
    empCardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    avatar:        { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
    avatarText:    { fontFamily: "Inter_700Bold", fontSize: 16 },
    empName:       { fontFamily: "Inter_700Bold", fontSize: 15 },
    empMeta:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    empMetaText:   { fontFamily: "Inter_400Regular", fontSize: 12 },
    empMetaDot:    { fontFamily: "Inter_400Regular", fontSize: 12 },
    grossBadge:    { alignItems: "flex-end" },
    grossLabel:    { fontFamily: "Inter_400Regular", fontSize: 11 },
    grossValue:    { fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 2 },

    cardDivider: { height: 1, marginBottom: 12 },
    payBlock:    { borderRadius: 10, borderWidth: 1, padding: 10 },
    payBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    payDot:      { width: 8, height: 8, borderRadius: 4 },
    payBlockTitle: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
    payStats:    { flexDirection: "row", gap: 0, flexWrap: "wrap" },
    payStat:     { flex: 1, minWidth: 80 },
    payStatLabel:{ fontFamily: "Inter_400Regular", fontSize: 11, marginBottom: 2 },
    payStatValue:{ fontFamily: "Inter_600SemiBold", fontSize: 13 },

    cardHint:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 10 },
    cardHintText:{ fontFamily: "Inter_400Regular", fontSize: 11 },

    footer:     { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 14,
                  paddingBottom: Platform.OS === "ios" ? 34 : 16 },
    footerRow:  { flexDirection: "row", gap: 0 },
    footerStat: { flex: 1, alignItems: "center" },
    footerStatBorder: { borderLeftWidth: 1 },
    footerStatLabel:  { fontFamily: "Inter_400Regular", fontSize: 10, marginBottom: 3 },
    footerStatValue:  { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  });
}
