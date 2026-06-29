import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListLabourEntries, useUpdateLabourEntry, useDeleteLabourEntry,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const WORK_TYPE_LABELS: Record<string, string> = {
  trenching: "Trenching", backfilling: "Backfilling", cable_pulling: "Cable Pulling",
  reinstatement: "Reinstatement", manhole_installation: "Manhole Install.", concrete: "Concrete", other: "Other",
};

export default function JobLabourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "supervisor" || user?.role === "project_manager";

  const { data: entries, isLoading } = useListLabourEntries(
    { jobId },
    { query: { queryKey: ["labour-entries", "job", jobId] } }
  );

  const updateEntry = useUpdateLabourEntry({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["labour-entries", "job", jobId] });
      },
    },
  });

  const deleteEntry = useDeleteLabourEntry({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["labour-entries", "job", jobId] }),
      onError: () => Alert.alert("Error", "Failed to delete entry"),
    },
  });

  const handleToggleStatus = (entry: any) => {
    if (!canEdit) return;
    updateEntry.mutate({
      id: entry.id,
      data: { status: entry.status === "complete" ? "open" : "complete" },
    });
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Entry", "Delete this labour entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEntry.mutate({ id }) },
    ]);
  };

  // Group entries by date
  const grouped = (entries ?? []).reduce<Record<string, typeof entries>>((acc, e) => {
    const d = e.date ?? "unknown";
    if (!acc[d]) acc[d] = [];
    acc[d]!.push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalLabour = entries?.reduce((s, e) => {
    if (e.payrollType === "hourly") return s + (e.amountPayable ? Number(e.amountPayable) : 0);
    if (e.payrollType === "piece_work" && e.status === "complete") return s + (e.amountPayable ? Number(e.amountPayable) : 0);
    return s;
  }, 0) ?? 0;

  const totalHours = entries?.filter(e => e.payrollType === "hourly").reduce((s, e) => s + (e.hoursWorked ? Number(e.hoursWorked) : 0), 0) ?? 0;
  const totalMeters = entries?.filter(e => e.payrollType === "piece_work" && e.status === "complete").reduce((s, e) => s + (e.metersCompleted ? Number(e.metersCompleted) : 0), 0) ?? 0;
  const openCount = entries?.filter(e => e.status === "open" && e.payrollType === "piece_work").length ?? 0;

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      {canEdit && (
        <TouchableOpacity
          style={[s.newDayBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push(`/job/${jobId}/daily-labour` as any)}
        >
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={s.newDayBtnText}>New Daily Entry</Text>
        </TouchableOpacity>
      )}

      {/* Summary bar */}
      {entries && entries.length > 0 && (
        <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {totalHours > 0 && (
            <View style={s.summaryItem}>
              <Feather name="clock" size={13} color="#2563EB" />
              <Text style={[s.summaryVal, { color: colors.foreground }]}>{totalHours.toFixed(1)}h</Text>
              <Text style={[s.summarySub, { color: colors.mutedForeground }]}>Hours</Text>
            </View>
          )}
          {totalMeters > 0 && (
            <View style={s.summaryItem}>
              <Feather name="activity" size={13} color="#8B5CF6" />
              <Text style={[s.summaryVal, { color: colors.foreground }]}>{totalMeters.toFixed(0)}m</Text>
              <Text style={[s.summarySub, { color: colors.mutedForeground }]}>Completed</Text>
            </View>
          )}
          {openCount > 0 && (
            <View style={s.summaryItem}>
              <Feather name="alert-circle" size={13} color="#F59E0B" />
              <Text style={[s.summaryVal, { color: "#F59E0B" }]}>{openCount}</Text>
              <Text style={[s.summarySub, { color: colors.mutedForeground }]}>Open</Text>
            </View>
          )}
          <View style={[s.summaryItem, { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 14 }]}>
            <Feather name="dollar-sign" size={13} color="#22C55E" />
            <Text style={[s.summaryVal, { color: "#22C55E" }]}>R {totalLabour.toFixed(2)}</Text>
            <Text style={[s.summarySub, { color: colors.mutedForeground }]}>Payable</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !entries?.length ? (
        <View style={s.empty}>
          <Feather name="users" size={44} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No labour entries yet</Text>
          {canEdit && (
            <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>
              Tap "New Daily Entry" to capture multiple employees at once
            </Text>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {dates.map(date => (
            <View key={date}>
              {/* Date group header */}
              <View style={s.dateHeader}>
                <Feather name="calendar" size={13} color={colors.primary} />
                <Text style={[s.dateLabel, { color: colors.primary }]}>
                  {new Date(date + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <Text style={[s.dateCount, { color: colors.mutedForeground }]}>
                  {grouped[date]!.length} entr{grouped[date]!.length !== 1 ? "ies" : "y"}
                </Text>
              </View>

              {grouped[date]!.map(entry => {
                const isPiece = entry.payrollType === "piece_work";
                const isOpen = entry.status === "open";
                const payAmount = isPiece && isOpen ? 0 : (entry.amountPayable ? Number(entry.amountPayable) : 0);

                return (
                  <View key={entry.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={s.cardRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.empName, { color: colors.foreground }]}>
                          {entry.employee?.name ?? `Employee #${entry.employeeId}`}
                        </Text>
                        <Text style={[s.workType, { color: colors.mutedForeground }]}>
                          {WORK_TYPE_LABELS[entry.workType] ?? entry.workType}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ color: payAmount > 0 ? "#22C55E" : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 14 }}>
                          {payAmount > 0 ? `R ${payAmount.toFixed(2)}` : "R 0.00"}
                        </Text>
                        <TouchableOpacity
                          style={[s.statusPill, {
                            backgroundColor: isOpen ? "#F59E0B22" : "#22C55E22",
                          }]}
                          onPress={() => canEdit && handleToggleStatus(entry)}
                        >
                          <View style={[s.statusDot, { backgroundColor: isOpen ? "#F59E0B" : "#22C55E" }]} />
                          <Text style={{ color: isOpen ? "#F59E0B" : "#22C55E", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                            {isOpen ? "Open" : "Complete"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[s.divider, { backgroundColor: colors.border }]} />

                    {/* Stats row */}
                    <View style={s.statsRow}>
                      {/* Payroll type badge */}
                      <View style={[s.typeBadge, { backgroundColor: isPiece ? "#8B5CF620" : "#2563EB20" }]}>
                        <Feather name={isPiece ? "activity" : "clock"} size={11} color={isPiece ? "#8B5CF6" : "#2563EB"} />
                        <Text style={{ color: isPiece ? "#8B5CF6" : "#2563EB", fontFamily: "Inter_500Medium", fontSize: 11 }}>
                          {isPiece ? "Piece Work" : "Hourly"}
                        </Text>
                      </View>

                      {!isPiece && entry.hoursWorked && (
                        <Text style={[s.statText, { color: colors.mutedForeground }]}>{Number(entry.hoursWorked).toFixed(1)}h</Text>
                      )}
                      {!isPiece && entry.rateUsed && (
                        <Text style={[s.statText, { color: colors.mutedForeground }]}>@ R{entry.rateUsed}/hr</Text>
                      )}
                      {!isPiece && entry.clockIn && entry.clockOut && (
                        <Text style={[s.statText, { color: colors.mutedForeground }]}>{entry.clockIn}–{entry.clockOut}</Text>
                      )}

                      {isPiece && entry.metersCompleted && (
                        <Text style={[s.statText, { color: colors.mutedForeground }]}>{entry.metersCompleted}m</Text>
                      )}
                      {isPiece && entry.rateUsed && (
                        <Text style={[s.statText, { color: colors.mutedForeground }]}>@ R{entry.rateUsed}/m</Text>
                      )}

                      {canEdit && (
                        <TouchableOpacity onPress={() => handleDelete(entry.id)} style={{ marginLeft: "auto" }}>
                          <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {entry.notes && (
                      <Text style={[s.notes, { color: colors.mutedForeground }]} numberOfLines={2}>{entry.notes}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    newDayBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, margin: 16, alignSelf: "flex-start" },
    newDayBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 },
    summaryCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", borderRadius: 12, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 8, gap: 12 },
    summaryItem: { alignItems: "center", gap: 3 },
    summaryVal: { fontFamily: "Inter_700Bold", fontSize: 15 },
    summarySub: { fontFamily: "Inter_400Regular", fontSize: 11 },
    dateHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 },
    dateLabel: { fontFamily: "Inter_700Bold", fontSize: 13 },
    dateCount: { fontFamily: "Inter_400Regular", fontSize: 12, marginLeft: "auto" },
    card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
    cardRow: { flexDirection: "row", alignItems: "flex-start" },
    empName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    workType: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    statusPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    divider: { height: 1, marginVertical: 10 },
    statsRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
    typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    statText: { fontFamily: "Inter_400Regular", fontSize: 12 },
    notes: { fontFamily: "Inter_400Regular", fontSize: 12, fontStyle: "italic", marginTop: 8 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60, paddingHorizontal: 32 },
    emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
    emptyHint: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" },
  });
}
