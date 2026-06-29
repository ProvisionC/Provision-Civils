import React, { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateLeave, useListEmployees } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

const LEAVE_TYPES = [
  { key: "annual", label: "Annual Leave" },
  { key: "sick", label: "Sick Leave" },
  { key: "family_responsibility", label: "Family Responsibility" },
  { key: "unpaid", label: "Unpaid Leave" },
];

export default function CreateLeaveScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "project_manager" || user?.role === "supervisor";

  const { data: employees } = useListEmployees();
  const [form, setForm] = useState({
    leaveType: "annual", startDate: "", endDate: "", days: "", notes: "",
    employeeId: "",
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const createLeave = useCreateLeave({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["leave"] });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to submit leave request"),
    },
  });

  const handleSubmit = () => {
    if (!form.startDate || !form.endDate || !form.days) {
      Alert.alert("Validation", "Start date, end date, and number of days are required");
      return;
    }
    createLeave.mutate({
      data: {
        leaveType: form.leaveType as any,
        startDate: form.startDate,
        endDate: form.endDate,
        days: Number(form.days),
        notes: form.notes || undefined,
        ...(isAdmin && form.employeeId ? { employeeId: Number(form.employeeId) } : {}),
      },
    });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 20 }}>Request Leave</Text>

      {isAdmin && employees && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Employee (leave blank for yourself)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={{ borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: !form.employeeId ? colors.primary : colors.muted, borderWidth: 1, borderColor: colors.border }} onPress={() => set("employeeId")("")}>
                <Text style={{ color: !form.employeeId ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Self</Text>
              </TouchableOpacity>
              {employees.map(e => (
                <TouchableOpacity key={e.id} style={{ borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: form.employeeId === String(e.id) ? colors.primary : colors.muted, borderWidth: 1, borderColor: colors.border }} onPress={() => set("employeeId")(String(e.id))}>
                  <Text style={{ color: form.employeeId === String(e.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{e.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Leave Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {LEAVE_TYPES.map(t => (
          <TouchableOpacity key={t.key} style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, backgroundColor: form.leaveType === t.key ? colors.primary : colors.muted, borderColor: colors.border }} onPress={() => set("leaveType")(t.key)}>
            <Text style={{ color: form.leaveType === t.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Field label="Start Date (YYYY-MM-DD)" value={form.startDate} onChange={set("startDate")} colors={colors} />
      <Field label="End Date (YYYY-MM-DD)" value={form.endDate} onChange={set("endDate")} colors={colors} />
      <Field label="Number of Days" value={form.days} onChange={set("days")} colors={colors} keyboard="decimal-pad" />
      <Field label="Notes (optional)" value={form.notes} onChange={set("notes")} colors={colors} multiline />

      <TouchableOpacity style={{ borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, opacity: createLeave.isPending ? 0.7 : 1 }} onPress={handleSubmit} disabled={createLeave.isPending}>
        {createLeave.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="calendar" size={18} color="#FFF" /><Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Submit Request</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, keyboard, colors, multiline }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6, color: colors.foreground }}>{label}</Text>
      <TextInput
        style={{ borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, ...(multiline ? { minHeight: 80, textAlignVertical: "top" } : {}) }}
        value={value} onChangeText={onChange} keyboardType={keyboard ?? "default"} autoCapitalize="none" multiline={multiline}
      />
    </View>
  );
}
