import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  type KeyboardTypeOptions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useListEmployees, useUpdateEmployee, getListEmployeesQueryKey,
  useUpsertEmployeeBanking, useGetEmployeeBanking, getGetEmployeeBankingQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { key: "worker", label: "Worker" },
  { key: "supervisor", label: "Supervisor" },
  { key: "project_manager", label: "PM" },
  { key: "admin", label: "Admin" },
];

const STATUSES = [
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
  { key: "resigned", label: "Resigned" },
  { key: "dismissed", label: "Dismissed" },
];

const PAYROLL_TYPES = [
  { key: "hourly", label: "Hourly" },
  { key: "piece_work", label: "Piece Work" },
];

const ACCOUNT_TYPES = [
  { key: "cheque", label: "Cheque" },
  { key: "savings", label: "Savings" },
  { key: "transmission", label: "Transmission" },
];

export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const empId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";

  const { data: employees } = useListEmployees();
  const employee = employees?.find(e => e.id === empId);

  const { data: bankingData } = useGetEmployeeBanking(empId, {
    query: { queryKey: getGetEmployeeBankingQueryKey(empId), enabled: isAdmin && !!empId, retry: false },
  });

  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "worker",
    employeeNumber: "", clockNumber: "", idNumber: "", dateOfBirth: "",
    homeAddress: "", emergencyContactName: "", emergencyContactNumber: "",
    jobTitle: "", department: "", employmentStartDate: "",
    employmentStatus: "active", payrollType: "hourly",
    hourlyRate: "", meterRate: "",
  });

  const [banking, setBanking] = useState({
    bankName: "", accountHolder: "", accountNumber: "", branchCode: "", accountType: "cheque",
  });

  const [activeTab, setActiveTab] = useState<"profile" | "payroll" | "banking">("profile");

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        email: employee.email,
        phone: employee.phone ?? "",
        role: employee.role,
        employeeNumber: employee.employeeNumber ?? "",
        clockNumber: employee.clockNumber ?? "",
        idNumber: employee.idNumber ?? "",
        dateOfBirth: employee.dateOfBirth ?? "",
        homeAddress: employee.homeAddress ?? "",
        emergencyContactName: employee.emergencyContactName ?? "",
        emergencyContactNumber: employee.emergencyContactNumber ?? "",
        jobTitle: employee.jobTitle ?? "",
        department: employee.department ?? "",
        employmentStartDate: employee.employmentStartDate ?? "",
        employmentStatus: employee.employmentStatus ?? "active",
        payrollType: employee.payrollType ?? "hourly",
        hourlyRate: employee.hourlyRate ?? "",
        meterRate: employee.meterRate ?? "",
      });
    }
  }, [employee]);

  useEffect(() => {
    if (bankingData) {
      setBanking({
        bankName: bankingData.bankName,
        accountHolder: bankingData.accountHolder,
        accountNumber: bankingData.accountNumber,
        branchCode: bankingData.branchCode,
        accountType: bankingData.accountType,
      });
    }
  }, [bankingData]);

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

  const upsertBanking = useUpsertEmployeeBanking({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Saved", "Banking details saved");
      },
      onError: () => Alert.alert("Error", "Failed to save banking details"),
    },
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const setB = (k: string) => (v: string) => setBanking(b => ({ ...b, [k]: v }));

  const handleSubmit = () => {
    if (!form.name.trim()) { Alert.alert("Validation", "Name is required"); return; }
    updateEmployee.mutate({
      id: empId,
      data: {
        name: form.name, email: form.email,
        phone: form.phone || undefined,
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

  const handleSaveBanking = () => {
    if (!banking.bankName || !banking.accountNumber || !banking.branchCode) {
      Alert.alert("Validation", "Bank name, account number, and branch code are required");
      return;
    }
    upsertBanking.mutate({ id: empId, data: banking as any });
  };

  if (!employee) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statusColor = { active: "#22C55E", suspended: "#F59E0B", resigned: "#6B7280", dismissed: "#EF4444" }[form.employmentStatus] ?? colors.mutedForeground;

  const tabs = [
    { key: "profile", label: "Profile" },
    { key: "payroll", label: "Payroll" },
    ...(isAdmin ? [{ key: "banking", label: "Banking" }] : []),
  ] as { key: "profile" | "payroll" | "banking"; label: string }[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: activeTab === t.key ? colors.primary : "transparent" }} onPress={() => setActiveTab(t.key)}>
            <Text style={{ fontFamily: activeTab === t.key ? "Inter_700Bold" : "Inter_400Regular", fontSize: 13, color: activeTab === t.key ? colors.primary : colors.mutedForeground }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {activeTab === "profile" && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20, padding: 14, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.primary }}>{employee.name[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground }}>{employee.name}</Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground }}>{employee.jobTitle ?? employee.role}</Text>
              </View>
              <View style={{ backgroundColor: statusColor + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: statusColor, fontFamily: "Inter_600SemiBold", fontSize: 12, textTransform: "capitalize" }}>{form.employmentStatus}</Text>
              </View>
            </View>

            <Section title="Personal Details" colors={colors}>
              <Field label="Full Name *" value={form.name} onChange={set("name")} colors={colors} />
              <Field label="Email" value={form.email} onChange={set("email")} colors={colors} keyboard="email-address" />
              <Field label="Phone" value={form.phone} onChange={set("phone")} colors={colors} keyboard="phone-pad" />
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

            <Section title="Status" colors={colors}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {STATUSES.map(s => (
                  <TouchableOpacity key={s.key} style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, backgroundColor: form.employmentStatus === s.key ? colors.primary : colors.muted, borderColor: colors.border }} onPress={() => set("employmentStatus")(s.key)}>
                    <Text style={{ color: form.employmentStatus === s.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            <Section title="Role" colors={colors}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ROLES.map(r => (
                  <TouchableOpacity key={r.key} style={{ borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, backgroundColor: form.role === r.key ? colors.primary : colors.muted, borderColor: colors.border }} onPress={() => set("role")(r.key)}>
                    <Text style={{ color: form.role === r.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            <Section title="Emergency Contact" colors={colors}>
              <Field label="Contact Name" value={form.emergencyContactName} onChange={set("emergencyContactName")} colors={colors} />
              <Field label="Contact Number" value={form.emergencyContactNumber} onChange={set("emergencyContactNumber")} colors={colors} keyboard="phone-pad" />
            </Section>

            <TouchableOpacity style={[{ borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, { backgroundColor: colors.primary }, updateEmployee.isPending && { opacity: 0.7 }]} onPress={handleSubmit} disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
                <><Feather name="save" size={18} color="#FFF" /><Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Save Changes</Text></>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeTab === "payroll" && (
          <>
            <Section title="Payroll Type" colors={colors}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {PAYROLL_TYPES.map(p => (
                  <TouchableOpacity key={p.key} style={{ flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, backgroundColor: form.payrollType === p.key ? colors.secondary : colors.muted, borderColor: colors.border }} onPress={() => set("payrollType")(p.key)}>
                    <Text style={{ color: form.payrollType === p.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            {form.payrollType === "hourly" && (
              <Section title="Rates" colors={colors}>
                <Field label="Hourly Rate (R)" value={form.hourlyRate} onChange={set("hourlyRate")} colors={colors} keyboard="decimal-pad" />
              </Section>
            )}
            {form.payrollType === "piece_work" && (
              <Section title="Rates" colors={colors}>
                <Field label="Meter Rate (R/m)" value={form.meterRate} onChange={set("meterRate")} colors={colors} keyboard="decimal-pad" />
              </Section>
            )}

            <TouchableOpacity style={[{ borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, { backgroundColor: colors.primary }, updateEmployee.isPending && { opacity: 0.7 }]} onPress={handleSubmit} disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
                <><Feather name="save" size={18} color="#FFF" /><Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Save Payroll</Text></>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeTab === "banking" && isAdmin && (
          <>
            <Section title="Banking Details" colors={colors}>
              <Field label="Bank Name" value={banking.bankName} onChange={setB("bankName")} colors={colors} />
              <Field label="Account Holder" value={banking.accountHolder} onChange={setB("accountHolder")} colors={colors} />
              <Field label="Account Number" value={banking.accountNumber} onChange={setB("accountNumber")} colors={colors} keyboard="numeric" />
              <Field label="Branch Code" value={banking.branchCode} onChange={setB("branchCode")} colors={colors} keyboard="numeric" />
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8, color: colors.foreground }}>Account Type</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {ACCOUNT_TYPES.map(a => (
                  <TouchableOpacity key={a.key} style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", borderWidth: 1, backgroundColor: banking.accountType === a.key ? colors.primary : colors.muted, borderColor: colors.border }} onPress={() => setB("accountType")(a.key)}>
                    <Text style={{ color: banking.accountType === a.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Section>

            <TouchableOpacity style={[{ borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, { backgroundColor: "#22C55E" }, upsertBanking.isPending && { opacity: 0.7 }]} onPress={handleSaveBanking} disabled={upsertBanking.isPending}>
              {upsertBanking.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
                <><Feather name="credit-card" size={18} color="#FFF" /><Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Save Banking</Text></>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
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
        autoCapitalize="none" multiline={multiline}
      />
    </View>
  );
}
