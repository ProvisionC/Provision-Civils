import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  type KeyboardTypeOptions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useListEmployees, useUpdateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const ROLES = [
  { key: "worker", label: "Worker" },
  { key: "supervisor", label: "Supervisor" },
  { key: "admin", label: "Admin" },
];

export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const empId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: employees } = useListEmployees();
  const employee = employees?.find(e => e.id === empId);

  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "worker" });

  useEffect(() => {
    if (employee) {
      setForm({ name: employee.name, email: employee.email, phone: employee.phone ?? "", role: employee.role });
    }
  }, [employee]);

  const updateEmployee = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to update employee"),
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { Alert.alert("Validation", "Name is required"); return; }
    updateEmployee.mutate({
      id: empId,
      data: { name: form.name, email: form.email, phone: form.phone || undefined, role: form.role as any },
    });
  };

  if (!employee) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Details</Text>
        <Field label="Full Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} colors={colors} />
        <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} colors={colors} keyboard="email-address" />
        <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} colors={colors} keyboard="phone-pad" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Role</Text>
        <View style={styles.roleChips}>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.key}
              style={[styles.roleChip, { backgroundColor: form.role === r.key ? colors.primary : colors.muted, borderColor: colors.border }]}
              onPress={() => setForm(f => ({ ...f, role: r.key }))}
            >
              <Text style={{ color: form.role === r.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, updateEmployee.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={updateEmployee.isPending}
      >
        {updateEmployee.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="save" size={18} color="#FFF" /><Text style={styles.submitText}>Save Changes</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

interface FieldProps { label: string; value: string; onChange: (v: string) => void; keyboard?: KeyboardTypeOptions; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; }
function Field({ label, value, onChange, keyboard, colors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
        value={value} onChangeText={onChange} keyboardType={keyboard ?? "default"}
        autoCapitalize={keyboard === "email-address" ? "none" : "words"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  roleChips: { flexDirection: "row", gap: 10 },
  roleChip: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
