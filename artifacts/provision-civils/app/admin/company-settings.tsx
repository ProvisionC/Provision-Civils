import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useGetCompanySettings, useUpdateCompanySettings } from "@workspace/api-client-react";

function Field({ label, value, onChangeText, multiline, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void;
  multiline?: boolean; placeholder?: string; keyboardType?: "default" | "phone-pad" | "email-address";
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, {
          color: colors.foreground, backgroundColor: colors.input,
          borderColor: colors.border, minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

export default function CompanySettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: settings, isLoading } = useGetCompanySettings({
    query: { queryKey: ["company-settings"] },
  });
  const updateMutation = useUpdateCompanySettings();

  const [form, setForm] = useState({
    companyName: "",
    vatNumber: "",
    registrationNumber: "",
    address: "",
    phone: "",
    email: "",
    payrollPeriod: "weekly",
  });

  const [banking, setBanking] = useState({
    bankName: "", accountNumber: "", branchCode: "", accountType: "",
  });

  const [labourRates, setLabourRates] = useState({
    standard: "", overtime: "", nightShift: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName ?? "",
        vatNumber: settings.vatNumber ?? "",
        registrationNumber: settings.registrationNumber ?? "",
        address: settings.address ?? "",
        phone: settings.phone ?? "",
        email: settings.email ?? "",
        payrollPeriod: settings.payrollPeriod ?? "weekly",
      });
      if (settings.bankingDetails && typeof settings.bankingDetails === "object") {
        const b = settings.bankingDetails as Record<string, string>;
        setBanking({
          bankName: b.bankName ?? "",
          accountNumber: b.accountNumber ?? "",
          branchCode: b.branchCode ?? "",
          accountType: b.accountType ?? "",
        });
      }
      if (settings.defaultLabourRates && typeof settings.defaultLabourRates === "object") {
        const r = settings.defaultLabourRates as Record<string, string>;
        setLabourRates({
          standard: r.standard ?? "",
          overtime: r.overtime ?? "",
          nightShift: r.nightShift ?? "",
        });
      }
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        data: {
          ...form,
          bankingDetails: banking as unknown as Record<string, unknown>,
          defaultLabourRates: labourRates as unknown as Record<string, unknown>,
        },
      });
      Alert.alert("Saved", "Company settings updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to save settings.");
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Company Settings</Text>
        <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: colors.primary }]} disabled={updateMutation.isPending}>
          {updateMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Company Info */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>COMPANY INFORMATION</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label="Company Name" value={form.companyName} onChangeText={v => setForm(f => ({ ...f, companyName: v }))} />
          <Field label="VAT Number" value={form.vatNumber} onChangeText={v => setForm(f => ({ ...f, vatNumber: v }))} placeholder="e.g. 4123456789" />
          <Field label="Registration Number" value={form.registrationNumber} onChangeText={v => setForm(f => ({ ...f, registrationNumber: v }))} />
          <Field label="Address" value={form.address} onChangeText={v => setForm(f => ({ ...f, address: v }))} multiline />
          <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
          <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" />
        </View>

        {/* Banking Details */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>BANKING DETAILS</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label="Bank Name" value={banking.bankName} onChangeText={v => setBanking(b => ({ ...b, bankName: v }))} />
          <Field label="Account Number" value={banking.accountNumber} onChangeText={v => setBanking(b => ({ ...b, accountNumber: v }))} keyboardType="phone-pad" />
          <Field label="Branch Code" value={banking.branchCode} onChangeText={v => setBanking(b => ({ ...b, branchCode: v }))} keyboardType="phone-pad" />
          <Field label="Account Type" value={banking.accountType} onChangeText={v => setBanking(b => ({ ...b, accountType: v }))} placeholder="e.g. Cheque / Current" />
        </View>

        {/* Labour Rates */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DEFAULT LABOUR RATES (R/hr)</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Field label="Standard Rate" value={labourRates.standard} onChangeText={v => setLabourRates(r => ({ ...r, standard: v }))} keyboardType="phone-pad" placeholder="e.g. 150" />
          <Field label="Overtime Rate" value={labourRates.overtime} onChangeText={v => setLabourRates(r => ({ ...r, overtime: v }))} keyboardType="phone-pad" placeholder="e.g. 225" />
          <Field label="Night Shift Rate" value={labourRates.nightShift} onChangeText={v => setLabourRates(r => ({ ...r, nightShift: v }))} keyboardType="phone-pad" placeholder="e.g. 200" />
        </View>

        {/* Payroll Period */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PAYROLL PERIOD</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {["weekly", "bi-weekly", "monthly"].map(period => (
            <TouchableOpacity
              key={period}
              style={[styles.radioRow, { borderBottomColor: colors.border }]}
              onPress={() => setForm(f => ({ ...f, payrollPeriod: period }))}
            >
              <View style={[styles.radio, { borderColor: colors.border }]}>
                {form.payrollPeriod === period && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.radioLabel, { color: colors.foreground }]}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingBottom: 12, borderBottomWidth: 1, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: "Inter_600SemiBold" },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 16, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  fieldWrap: { padding: 12, gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  fieldInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontFamily: "Inter_400Regular" },
  radioRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
