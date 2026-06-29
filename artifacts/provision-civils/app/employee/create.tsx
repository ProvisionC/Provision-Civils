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
  { key: "project_manager", label: "PM" },
  { key: "admin", label: "Admin" },
];

const PAYROLL_TYPES = [
  { key: "hourly", label: "Hourly" },
  { key: "piece_work", label: "Piece Work" },
];

export default function CreateEmployeeScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", role: "worker",
    employeeNumber: "", clockNumber: "", idNumber: "", dateOfBirth: "",
    homeAddress: "", emergencyContactName: "", emergencyContactNumber: "",
    jobTitle: "", department: "", employmentStartDate: "",
    employmentStatus: "active", payrollType: "hourly",
    hourlyRate: "", meterRate: "",
  });
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

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

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
        employeeNumber: form.employeeNumber || undefined,
        clockNumber: form.clockNumber || undefined,
        idNumber: form.idNumber || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        homeAddress: form.homeAddress || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactNumber: form.emergencyContactNumber || undefined,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        employmentStartDate: form.employmentStartDate || undefined,
        employmentStatus: form.employmentStatus as any,
        payrollType: form.payrollType as any,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        meterRate: form.meterRate ? Number(form.meterRate) : undefined,
      },
    });
  };

  const s = styles(colors);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Section title="Personal Details" colors={colors}>
        <Field label="Full Name *" value={form.name} onChange={set("name")} colors={colors} />
        <Field label="Email Address *" value={form.email} onChange={set("email")} colors={colors} keyboard="email-address" />
        <Field label="Phone Number" value={form.phone} onChange={set("phone")} colors={colors} keyboard="phone-pad" />
        <Field label="SA ID Number" value={form.idNumber} onChange={set("idNumber")} colors={colors} />
        <Field label="Date of Birth (YYYY-MM-DD)" value={form.dateOfBirth} onChange={set("dateOfBirth")} colors={colors} />
        <Field label="Home Address" value={form.homeAddress} onChange={set("homeAddress")} colors={colors} multiline />
      </Section>

      <Section title="Employment" colors={colors}>
        <Field label="Employee Number" value={form.employeeNumber} onChange={set("employeeNumber")} colors={colors} />
        <Field label="Clock Number" value={form.clockNumber} onChange={set("clockNumber")} colors={colors} />
        <Field label="Job Title" value={form.jobTitle} onChange={set("jobTitle")} colors={colors} />
        <Field label="Department" value={form.department} onChange={set("department")} colors={colors} />
        <Field label="Start Date (YYYY-MM-DD)" value={form.employmentStartDate} onChange={set("employmentStartDate")} colors={colors} />
      </Section>

      <Section title="Role" colors={colors}>
        <View style={s.chips}>
          {ROLES.map(r => (
            <TouchableOpacity key={r.key} style={[s.chip, { backgroundColor: form.role === r.key ? colors.primary : colors.muted, borderColor: colors.border }]} onPress={() => set("role")(r.key)}>
              <Text style={{ color: form.role === r.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Payroll" colors={colors}>
        <View style={s.chips}>
          {PAYROLL_TYPES.map(p => (
            <TouchableOpacity key={p.key} style={[s.chip, { backgroundColor: form.payrollType === p.key ? colors.secondary : colors.muted, borderColor: colors.border }]} onPress={() => set("payrollType")(p.key)}>
              <Text style={{ color: form.payrollType === p.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.payrollType === "hourly" && (
          <Field label="Hourly Rate (R)" value={form.hourlyRate} onChange={set("hourlyRate")} colors={colors} keyboard="decimal-pad" />
        )}
        {form.payrollType === "piece_work" && (
          <Field label="Meter Rate (R/m)" value={form.meterRate} onChange={set("meterRate")} colors={colors} keyboard="decimal-pad" />
        )}
      </Section>

      <Section title="Emergency Contact" colors={colors}>
        <Field label="Contact Name" value={form.emergencyContactName} onChange={set("emergencyContactName")} colors={colors} />
        <Field label="Contact Number" value={form.emergencyContactNumber} onChange={set("emergencyContactNumber")} colors={colors} keyboard="phone-pad" />
      </Section>

      <Section title="Security" colors={colors}>
        <View style={s.field}>
          <Text style={[s.label, { color: colors.foreground }]}>Password *</Text>
          <View style={[s.passwordWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput style={[s.passwordInput, { color: colors.foreground }]} value={form.password} onChangeText={set("password")} secureTextEntry={!showPassword} placeholder="Min. 6 characters" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </Section>

      <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }, createEmployee.isPending && { opacity: 0.7 }]} onPress={handleSubmit} disabled={createEmployee.isPending}>
        {createEmployee.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="user-plus" size={18} color="#FFF" /><Text style={s.submitText}>Add Employee</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12, color: colors.foreground }}>{title}</Text>
      {children}
    </View>
  );
}

interface FieldProps { label: string; value: string; onChange: (v: string) => void; keyboard?: KeyboardTypeOptions; colors: any; multiline?: boolean; }
function Field({ label, value, onChange, keyboard, colors, multiline }: FieldProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6, color: colors.foreground }}>{label}</Text>
      <TextInput
        style={{ borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, ...(multiline ? { minHeight: 80, textAlignVertical: "top" } : {}) }}
        value={value} onChangeText={onChange} keyboardType={keyboard ?? "default"}
        autoCapitalize={keyboard === "email-address" ? "none" : "none"}
        multiline={multiline}
      />
    </View>
  );
}

function styles(colors: any) {
  return StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
    chip: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", borderWidth: 1 },
    field: { marginBottom: 12 },
    label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
    passwordWrap: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
    passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
}
