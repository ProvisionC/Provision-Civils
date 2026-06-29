import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListLabourEntries, useUpdateLabourEntry, useDeleteLabourEntry,
  useListEmployees,
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

  const { data: employees } = useListEmployees();

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

  const getEmployeeName = (empId: number) => {
    return employees?.find(e => e.id === empId)?.name ?? "Unknown";
  };

  const totalAmount = entries?.reduce((s, e) => s + (e.amountPayable ? Number(e.amountPayable) : 0), 0) ?? 0;
  const totalHours = entries?.reduce((s, e) => s + (e.payrollType === "hourly" && e.hoursWorked ? Number(e.hoursWorked) : 0), 0) ?? 0;
  const totalMeters = entries?.reduce((s, e) => s + (e.payrollType === "piece_work" && e.metersCompleted ? Number(e.metersCompleted) : 0), 0) ?? 0;

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      {canEdit && (
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push({ pathname: "/labour/create", params: { jobId: String(jobId) } } as any)}
        >
          <Feather name="plus" size={16} color="#FFF" />
          <Text style={s.addBtnText}>Add Entry</Text>
        </TouchableOpacity>
      )}

      {(totalHours > 0 || totalMeters > 0 || totalAmount > 0) && (
        <View style={[s.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {totalHours > 0 && (
            <View style={s.summaryItem}>
              <Feather name="clock" size={14} color={colors.primary} />
              <Text style={[s.summaryValue, { color: colors.foreground }]}>{totalHours.toFixed(1)}h</Text>
              <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Hours</Text>
            </View>
          )}
          {totalMeters > 0 && (
            <View style={s.summaryItem}>
              <Feather name="activity" size={14} color="#8B5CF6" />
              <Text style={[s.summaryValue, { color: colors.foreground }]}>{totalMeters.toFixed(0)}m</Text>
              <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Meters</Text>
            </View>
          )}
          <View style={s.summaryItem}>
            <Feather name="dollar-sign" size={14} color="#22C55E" />
            <Text style={[s.summaryValue, { color: "#22C55E" }]}>R {totalAmount.toFixed(2)}</Text>
            <Text style={[s.summaryLabel, { color: colors.mutedForeground }]}>Payable</Text>
          </View>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !entries?.length ? (
        <View style={s.empty}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No labour entries yet</Text>
          {canEdit && (
            <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>Tap "Add Entry" to record work</Text>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {entries.map(entry => (
            <View key={entry.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.empName, { color: colors.foreground }]}>
                    {entry.employee?.name ?? getEmployeeName(entry.employeeId)}
                  </Text>
                  <Text style={[s.sub, { color: colors.mutedForeground }]}>
                    {entry.date} · {WORK_TYPE_LABELS[entry.workType] ?? entry.workType}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {entry.amountPayable && (
                    <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                      R {Number(entry.amountPayable).toFixed(2)}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[s.statusBtn, { backgroundColor: entry.status === "complete" ? "#22C55E22" : colors.muted }]}
                    onPress={() => canEdit && handleToggleStatus(entry)}
                  >
                    <Text style={{ color: entry.status === "complete" ? "#22C55E" : colors.mutedForeground, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
                      {entry.status}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[s.divider, { backgroundColor: colors.border }]} />

              <View style={s.statsRow}>
                {entry.payrollType === "hourly" && entry.hoursWorked && (
                  <View style={s.stat}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={[s.statText, { color: colors.mutedForeground }]}>{entry.hoursWorked}h</Text>
                  </View>
                )}
                {entry.payrollType === "piece_work" && entry.metersCompleted && (
                  <View style={s.stat}>
                    <Feather name="activity" size={12} color={colors.mutedForeground} />
                    <Text style={[s.statText, { color: colors.mutedForeground }]}>{entry.metersCompleted}m</Text>
                  </View>
                )}
                {entry.rateUsed && (
                  <Text style={[s.statText, { color: colors.mutedForeground }]}>@ R{entry.rateUsed}/{entry.payrollType === "hourly" ? "hr" : "m"}</Text>
                )}
                {entry.clockIn && entry.clockOut && (
                  <Text style={[s.statText, { color: colors.mutedForeground }]}>{entry.clockIn}–{entry.clockOut}</Text>
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
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, margin: 16, alignSelf: "flex-start" },
    addBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 14 },
    summaryRow: { flexDirection: "row", justifyContent: "space-around", borderRadius: 12, borderWidth: 1, padding: 14, marginHorizontal: 16, marginBottom: 8 },
    summaryItem: { alignItems: "center", gap: 3 },
    summaryValue: { fontFamily: "Inter_700Bold", fontSize: 16 },
    summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 11 },
    card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
    cardRow: { flexDirection: "row", alignItems: "flex-start" },
    empName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    sub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
    statusBtn: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    divider: { height: 1, marginVertical: 10 },
    statsRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
    stat: { flexDirection: "row", alignItems: "center", gap: 4 },
    statText: { fontFamily: "Inter_400Regular", fontSize: 12 },
    notes: { fontFamily: "Inter_400Regular", fontSize: 12, fontStyle: "italic", marginTop: 6 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 15 },
    emptyHint: { fontFamily: "Inter_400Regular", fontSize: 13 },
  });
}
