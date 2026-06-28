import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  type KeyboardTypeOptions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateInvoice, useGetJob, getListInvoicesQueryKey, getGetJobQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function CreateInvoiceScreen() {
  const { jobId: jobIdParam } = useLocalSearchParams<{ jobId: string }>();
  const jobId = Number(jobIdParam);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: job } = useGetJob(jobId, { query: { queryKey: getGetJobQueryKey(jobId), enabled: !!jobId } });

  const [form, setForm] = useState({
    labourCost: "", materialsCost: "", equipmentCost: "",
    vat: "15", notes: "",
  });

  const createInvoice = useCreateInvoice({
    mutation: {
      onSuccess: (inv) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        router.replace(`/invoice/${inv.id}` as any);
      },
      onError: () => Alert.alert("Error", "Failed to create invoice"),
    },
  });

  const labour = Number(form.labourCost) || 0;
  const materials = Number(form.materialsCost) || 0;
  const equipment = Number(form.equipmentCost) || 0;
  const vat = Number(form.vat) || 15;
  const subtotal = labour + materials + equipment;
  const vatAmount = subtotal * (vat / 100);
  const total = subtotal + vatAmount;

  const handleSubmit = () => {
    if (!jobId) { Alert.alert("Error", "No job selected"); return; }
    createInvoice.mutate({
      data: {
        jobId, labourCost: labour, materialsCost: materials,
        equipmentCost: equipment, vat, notes: form.notes || undefined,
      },
    });
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
      {job && (
        <View style={[styles.jobCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.jobNumber, { color: colors.primary }]}>{job.jobNumber}</Text>
          <Text style={[styles.clientName, { color: colors.foreground }]}>{job.clientName}</Text>
          {job.siteAddress && <Text style={[styles.address, { color: colors.mutedForeground }]}>{job.siteAddress}</Text>}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cost Breakdown</Text>
        <Field label="Labour Cost (R)" value={form.labourCost} onChange={v => setForm(f => ({ ...f, labourCost: v }))} colors={colors} keyboard="numeric" />
        <Field label="Materials Cost (R)" value={form.materialsCost} onChange={v => setForm(f => ({ ...f, materialsCost: v }))} colors={colors} keyboard="numeric" />
        <Field label="Equipment Cost (R)" value={form.equipmentCost} onChange={v => setForm(f => ({ ...f, equipmentCost: v }))} colors={colors} keyboard="numeric" />
        <Field label="VAT (%)" value={form.vat} onChange={v => setForm(f => ({ ...f, vat: v }))} colors={colors} keyboard="numeric" />
      </View>

      <View style={[styles.summary, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
        <SummaryRow label="Subtotal" value={`R${subtotal.toFixed(2)}`} colors={colors} />
        <SummaryRow label={`VAT (${vat}%)`} value={`R${vatAmount.toFixed(2)}`} colors={colors} />
        <View style={[styles.totalRow, { borderTopColor: colors.primary + "30" }]}>
          <Text style={[styles.totalLabel, { color: colors.primary }]}>TOTAL</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>R{total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Field label="Notes (optional)" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} colors={colors} multi />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, createInvoice.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={createInvoice.isPending}
      >
        {createInvoice.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="file-text" size={18} color="#FFF" /><Text style={styles.submitText}>Generate Invoice</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

interface FieldProps { label: string; value: string; onChange: (v: string) => void; multi?: boolean; keyboard?: KeyboardTypeOptions; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; }
function Field({ label, value, onChange, multi, keyboard, colors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, multi && { minHeight: 80, textAlignVertical: "top" as const }]}
        value={value} onChangeText={onChange} multiline={multi} keyboardType={keyboard ?? "default"}
      />
    </View>
  );
}

function SummaryRow({ label, value, colors }: any) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  jobCard: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 20, gap: 4 },
  jobNumber: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  clientName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  address: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  summary: { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 20, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
