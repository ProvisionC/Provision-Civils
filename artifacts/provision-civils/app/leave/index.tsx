import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useListLeave, useCreateLeave, useUpdateLeaveStatus, useDeleteLeave, useListEmployees } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const LEAVE_TYPES = [
  { key: "annual", label: "Annual", color: "#8B5CF6" },
  { key: "sick", label: "Sick", color: "#EF4444" },
  { key: "family_responsibility", label: "Family", color: "#F59E0B" },
  { key: "unpaid", label: "Unpaid", color: "#6B7280" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", approved: "#22C55E", rejected: "#EF4444",
};

export default function LeaveScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin" || user?.role === "project_manager" || user?.role === "supervisor";

  const { data: leave, isLoading } = useListLeave();
  const { data: employees } = useListEmployees();

  const updateStatus = useUpdateLeaveStatus({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["leave"] });
      },
    },
  });

  const deleteLeave = useDeleteLeave({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
      onError: () => Alert.alert("Error", "Failed to delete leave record"),
    },
  });

  const handleApprove = (id: number) => {
    updateStatus.mutate({ id, data: { status: "approved" } });
  };

  const handleReject = (id: number) => {
    Alert.alert("Reject Leave", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => updateStatus.mutate({ id, data: { status: "rejected" } }) },
    ]);
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete", "Delete this leave record?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLeave.mutate({ id }) },
    ]);
  };

  const getEmployeeName = (id: number) => employees?.find(e => e.id === id)?.name ?? "Unknown";

  const s = makeStyles(colors);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Leave</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push("/leave/create" as any)}>
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={s.newBtnText}>Request Leave</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !leave?.length ? (
        <View style={s.empty}>
          <Feather name="calendar" size={48} color={colors.mutedForeground} />
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No leave records</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {leave.map(record => {
            const leaveType = LEAVE_TYPES.find(l => l.key === record.leaveType);
            const statusColor = STATUS_COLORS[record.status] ?? colors.mutedForeground;
            return (
              <View key={record.id} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.cardHeader}>
                  <View style={[s.typeDot, { backgroundColor: (leaveType?.color ?? "#888") + "22" }]}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: leaveType?.color ?? "#888" }}>{leaveType?.label ?? record.leaveType}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusColor + "22" }]}>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: statusColor, textTransform: "capitalize" }}>{record.status}</Text>
                  </View>
                </View>

                {isAdmin && (
                  <Text style={[s.empName, { color: colors.foreground }]}>{record.employee?.name ?? getEmployeeName(record.employeeId)}</Text>
                )}

                <Text style={[s.dates, { color: colors.foreground }]}>
                  {record.startDate} → {record.endDate}
                </Text>
                <Text style={[s.days, { color: colors.mutedForeground }]}>{record.days} day{Number(record.days) !== 1 ? "s" : ""}</Text>
                {record.notes && <Text style={[s.notes, { color: colors.mutedForeground }]}>{record.notes}</Text>}

                {isAdmin && record.status === "pending" && (
                  <View style={s.actions}>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#22C55E22", borderColor: "#22C55E" }]} onPress={() => handleApprove(record.id)}>
                      <Feather name="check" size={14} color="#22C55E" />
                      <Text style={{ color: "#22C55E", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#EF444422", borderColor: "#EF4444" }]} onPress={() => handleReject(record.id)}>
                      <Feather name="x" size={14} color="#EF4444" />
                      <Text style={{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(record.id)} style={{ padding: 4 }}>
                      <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
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
    card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
    cardHeader: { flexDirection: "row", gap: 8, marginBottom: 8 },
    typeDot: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    empName: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
    dates: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 2 },
    days: { fontFamily: "Inter_400Regular", fontSize: 13, marginBottom: 4 },
    notes: { fontFamily: "Inter_400Regular", fontSize: 13, fontStyle: "italic" },
    actions: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 15 },
  });
}
