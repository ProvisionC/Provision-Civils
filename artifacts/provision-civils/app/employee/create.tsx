import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  type KeyboardTypeOptions,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

const ROLES = [
  { key: "worker", label: "Worker" },
  { key: "supervisor", label: "Supervisor" },
  { key: "admin", label: "Admin" },
];

export default function CreateEmployeeScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "worker" });
  const [showPassword, setShowPassword] = useState(false);

  const createEmployee = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to create employee. Email may already be in use."),
    },
  });

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      Alert.alert("Validation", "Name, email, and password are required");
      return;
    }
    createEmployee.mutate({
      data: {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone || undefined,
        password: form.password,
        role: form.role as any,
      },
    });
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Personal Details</Text>
        <Field label="Full Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} colors={colors} />
        <Field label="Email Address *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} colors={colors} keyboard="email-address" />
        <Field label="Phone Number" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} colors={colors} keyboard="phone-pad" />
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

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Security</Text>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Password *</Text>
          <View style={[styles.passwordWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: colors.foreground }]}
              value={form.password}
              onChangeText={v => setForm(f => ({ ...f, password: v }))}
              secureTextEntry={!showPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, createEmployee.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={createEmployee.isPending}
      >
        {createEmployee.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="user-plus" size={18} color="#FFF" /><Text style={styles.submitText}>Add Employee</Text></>
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
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  roleChips: { flexDirection: "row", gap: 10 },
  roleChip: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  passwordWrap: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
