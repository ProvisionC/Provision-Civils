import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  type KeyboardTypeOptions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useGetJob, useUpdateJob, useListEmployees, getGetJobQueryKey, getListJobsQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: job } = useGetJob(jobId, { query: { queryKey: getGetJobQueryKey(jobId) } });
  const { data: employees } = useListEmployees();
  const supervisors = employees?.filter(e => e.role === "supervisor" || e.role === "admin") ?? [];
  const workers = employees?.filter(e => e.role === "worker") ?? [];

  const [form, setForm] = useState({
    clientName: "", clientPhone: "", clientEmail: "",
    siteAddress: "", description: "", notes: "",
    labourHours: "", dueDate: "", supervisorId: "",
  });
  const [selectedWorkers, setSelectedWorkers] = useState<number[]>([]);
  const [materials, setMaterials] = useState<{ name: string; quantity: string; unit: string; cost: string }[]>([]);
  const [equipment, setEquipment] = useState<{ name: string; quantity: string; cost: string }[]>([]);

  useEffect(() => {
    if (!job) return;
    setForm({
      clientName: job.clientName ?? "",
      clientPhone: job.clientPhone ?? "",
      clientEmail: job.clientEmail ?? "",
      siteAddress: job.siteAddress ?? "",
      description: job.description ?? "",
      notes: job.notes ?? "",
      labourHours: job.labourHours != null ? String(job.labourHours) : "",
      dueDate: job.dueDate ?? "",
      supervisorId: job.supervisorId != null ? String(job.supervisorId) : "",
    });
    const detail = job as any;
    if (detail.workers) setSelectedWorkers(detail.workers.map((w: any) => w.id));
    if (detail.materials) setMaterials(detail.materials.map((m: any) => ({ name: m.name, quantity: String(m.quantity), unit: m.unit, cost: m.cost != null ? String(m.cost) : "" })));
    if (detail.equipment) setEquipment(detail.equipment.map((e: any) => ({ name: e.name, quantity: String(e.quantity), cost: e.cost != null ? String(e.cost) : "" })));
  }, [job]);

  const updateJob = useUpdateJob({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to update job"),
    },
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));
  const toggleWorker = (id: number) => setSelectedWorkers(w => w.includes(id) ? w.filter(x => x !== id) : [...w, id]);

  const handleSubmit = () => {
    if (!form.clientName.trim()) { Alert.alert("Validation", "Client name is required"); return; }
    updateJob.mutate({
      id: jobId,
      data: {
        clientName: form.clientName.trim(),
        clientPhone: form.clientPhone || undefined,
        clientEmail: form.clientEmail || undefined,
        siteAddress: form.siteAddress || undefined,
        description: form.description || undefined,
        notes: form.notes || undefined,
        labourHours: form.labourHours ? Number(form.labourHours) : undefined,
        dueDate: form.dueDate || undefined,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : undefined,
        workerIds: selectedWorkers,
        materials: materials.filter(m => m.name).map(m => ({ name: m.name, quantity: Number(m.quantity) || 0, unit: m.unit, cost: m.cost ? Number(m.cost) : undefined })),
        equipment: equipment.filter(e => e.name).map(e => ({ name: e.name, quantity: Number(e.quantity) || 0, cost: e.cost ? Number(e.cost) : undefined })),
      } as any,
    });
  };

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Client Information</Text>
        <Field label="Client Name *" value={form.clientName} onChange={v => update("clientName", v)} colors={colors} />
        <Field label="Phone" value={form.clientPhone} onChange={v => update("clientPhone", v)} keyboard="phone-pad" colors={colors} />
        <Field label="Email" value={form.clientEmail} onChange={v => update("clientEmail", v)} keyboard="email-address" colors={colors} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Job Details</Text>
        <Field label="Site Address" value={form.siteAddress} onChange={v => update("siteAddress", v)} colors={colors} />
        <Field label="Description" value={form.description} onChange={v => update("description", v)} multi colors={colors} />
        <Field label="Notes" value={form.notes} onChange={v => update("notes", v)} multi colors={colors} />
        <Field label="Labour Hours" value={form.labourHours} onChange={v => update("labourHours", v)} keyboard="numeric" colors={colors} />
        <Field label="Due Date (YYYY-MM-DD)" value={form.dueDate} onChange={v => update("dueDate", v)} colors={colors} />
      </View>

      {supervisors.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Supervisor</Text>
          <View style={styles.chips}>
            {supervisors.map(s => (
              <TouchableOpacity key={s.id}
                style={[styles.chip, { backgroundColor: form.supervisorId === String(s.id) ? colors.primary : colors.muted, borderColor: colors.border }]}
                onPress={() => update("supervisorId", form.supervisorId === String(s.id) ? "" : String(s.id))}>
                <Text style={{ color: form.supervisorId === String(s.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {workers.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Workers</Text>
          <View style={styles.chips}>
            {workers.map(w => (
              <TouchableOpacity key={w.id}
                style={[styles.chip, { backgroundColor: selectedWorkers.includes(w.id) ? colors.primary : colors.muted, borderColor: colors.border }]}
                onPress={() => toggleWorker(w.id)}>
                <Text style={{ color: selectedWorkers.includes(w.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Materials</Text>
          <TouchableOpacity onPress={() => setMaterials(m => [...m, { name: "", quantity: "1", unit: "m", cost: "" }])}>
            <Feather name="plus-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {materials.map((m, i) => (
          <View key={i} style={[styles.tableItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TextInput style={[styles.tableInput, { color: colors.foreground, flex: 2 }]} placeholder="Name" placeholderTextColor={colors.mutedForeground} value={m.name} onChangeText={v => setMaterials(ms => ms.map((x, j) => j === i ? { ...x, name: v } : x))} />
            <TextInput style={[styles.tableInput, { color: colors.foreground, flex: 1 }]} placeholder="Qty" placeholderTextColor={colors.mutedForeground} value={m.quantity} keyboardType="numeric" onChangeText={v => setMaterials(ms => ms.map((x, j) => j === i ? { ...x, quantity: v } : x))} />
            <TextInput style={[styles.tableInput, { color: colors.foreground, flex: 1 }]} placeholder="Unit" placeholderTextColor={colors.mutedForeground} value={m.unit} onChangeText={v => setMaterials(ms => ms.map((x, j) => j === i ? { ...x, unit: v } : x))} />
            <TouchableOpacity onPress={() => setMaterials(ms => ms.filter((_, j) => j !== i))}><Feather name="x" size={16} color={colors.destructive} /></TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Equipment</Text>
          <TouchableOpacity onPress={() => setEquipment(e => [...e, { name: "", quantity: "1", cost: "" }])}>
            <Feather name="plus-circle" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {equipment.map((e, i) => (
          <View key={i} style={[styles.tableItem, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TextInput style={[styles.tableInput, { color: colors.foreground, flex: 2 }]} placeholder="Name" placeholderTextColor={colors.mutedForeground} value={e.name} onChangeText={v => setEquipment(eq => eq.map((x, j) => j === i ? { ...x, name: v } : x))} />
            <TextInput style={[styles.tableInput, { color: colors.foreground, flex: 1 }]} placeholder="Qty" placeholderTextColor={colors.mutedForeground} value={e.quantity} keyboardType="numeric" onChangeText={v => setEquipment(eq => eq.map((x, j) => j === i ? { ...x, quantity: v } : x))} />
            <TouchableOpacity onPress={() => setEquipment(eq => eq.filter((_, j) => j !== i))}><Feather name="x" size={16} color={colors.destructive} /></TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }, updateJob.isPending && styles.disabled]} onPress={handleSubmit} disabled={updateJob.isPending} activeOpacity={0.85}>
        {updateJob.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (<><Feather name="save" size={18} color="#FFF" /><Text style={styles.submitText}>Save Changes</Text></>)}
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
        style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, multi && styles.multiline]}
        value={value} onChangeText={onChange} multiline={multi} keyboardType={keyboard ?? "default"}
        autoCapitalize={keyboard === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  tableItem: { flexDirection: "row", borderRadius: 8, borderWidth: 1, padding: 8, gap: 6, alignItems: "center", marginBottom: 8 },
  tableInput: { fontSize: 13, fontFamily: "Inter_400Regular", padding: 4 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.7 },
});
