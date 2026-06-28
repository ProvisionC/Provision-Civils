import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
  type KeyboardTypeOptions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useNavigation } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateJob, useListEmployees, getListJobsQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function CreateJobScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const nav = useNavigation();

  const [form, setForm] = useState({
    clientName: "", clientPhone: "", clientEmail: "",
    siteAddress: "", description: "", notes: "",
    labourHours: "", dueDate: "", supervisorId: "",
  });

  const { data: employees } = useListEmployees();
  const supervisors = employees?.filter(e => e.role === "supervisor" || e.role === "admin") ?? [];

  const createJob = useCreateJob({
    mutation: {
      onSuccess: (job) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
        router.replace(`/job/${job.id}` as any);
      },
      onError: () => {
        Alert.alert("Error", "Failed to create job. Please try again.");
      },
    },
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.clientName.trim()) {
      Alert.alert("Validation", "Client name is required");
      return;
    }
    createJob.mutate({
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
      },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Client Information</Text>
        <Field label="Client Name *" value={form.clientName} onChangeText={v => update("clientName", v)} placeholder="e.g. ABC Construction" colors={colors} />
        <Field label="Phone" value={form.clientPhone} onChangeText={v => update("clientPhone", v)} placeholder="+27 xx xxx xxxx" keyboardType="phone-pad" colors={colors} />
        <Field label="Email" value={form.clientEmail} onChangeText={v => update("clientEmail", v)} placeholder="client@example.com" keyboardType="email-address" colors={colors} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Job Details</Text>
        <Field label="Site Address" value={form.siteAddress} onChangeText={v => update("siteAddress", v)} placeholder="123 Main St, Johannesburg" colors={colors} />
        <Field label="Description" value={form.description} onChangeText={v => update("description", v)} placeholder="Describe the work..." multiline colors={colors} />
        <Field label="Notes" value={form.notes} onChangeText={v => update("notes", v)} placeholder="Additional notes..." multiline colors={colors} />
        <Field label="Labour Hours" value={form.labourHours} onChangeText={v => update("labourHours", v)} placeholder="0" keyboardType="numeric" colors={colors} />
        <Field label="Due Date (YYYY-MM-DD)" value={form.dueDate} onChangeText={v => update("dueDate", v)} placeholder="2024-12-31" colors={colors} />
      </View>

      {supervisors.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Assign Supervisor</Text>
          <View style={styles.chips}>
            {supervisors.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: form.supervisorId === String(s.id) ? colors.primary : colors.muted,
                    borderColor: form.supervisorId === String(s.id) ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => update("supervisorId", form.supervisorId === String(s.id) ? "" : String(s.id))}
              >
                <Text style={{ color: form.supervisorId === String(s.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, createJob.isPending && styles.disabled]}
        onPress={handleSubmit}
        disabled={createJob.isPending}
        activeOpacity={0.85}
      >
        {createJob.isPending ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Feather name="check" size={18} color="#FFF" />
            <Text style={styles.submitText}>Create Job</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

interface FieldProps { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: KeyboardTypeOptions; colors: ReturnType<typeof import("@/hooks/useColors").useColors>; }
function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, colors }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
          multiline && styles.multiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 0 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular",
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  submitBtn: {
    borderRadius: 14, paddingVertical: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8,
  },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  disabled: { opacity: 0.7 },
});
