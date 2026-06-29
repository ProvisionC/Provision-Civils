import React, { useState } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateLabourEntry, useListEmployees, useListJobs } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

const WORK_TYPES = [
  { key: "trenching", label: "Trenching" },
  { key: "backfilling", label: "Backfilling" },
  { key: "cable_pulling", label: "Cable Pulling" },
  { key: "reinstatement", label: "Reinstatement" },
  { key: "manhole_installation", label: "Manhole Installation" },
  { key: "concrete", label: "Concrete" },
  { key: "other", label: "Other" },
];

const PAYROLL_TYPES = [
  { key: "hourly", label: "Hourly" },
  { key: "piece_work", label: "Piece Work" },
];

export default function CreateLabourEntryScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ jobId?: string; employeeId?: string }>();

  const { data: employees } = useListEmployees();
  const { data: jobs } = useListJobs();

  const TODAY = new Date();
  const todayStr = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, "0")}-${String(TODAY.getDate()).padStart(2, "0")}`;

  const [form, setForm] = useState({
    jobId: params.jobId ?? "",
    employeeId: params.employeeId ?? (user?.role === "worker" ? String(user?.id ?? "") : ""),
    date: todayStr,
    workType: "trenching",
    payrollType: "hourly",
    clockIn: "", clockOut: "", breakMinutes: "0",
    hoursWorked: "", startChainage: "", endChainage: "",
    metersCompleted: "", rateUsed: "", amountPayable: "", notes: "",
  });

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const createEntry = useCreateLabourEntry({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["labour-entries"] });
        qc.invalidateQueries({ queryKey: ["payroll"] });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to create labour entry"),
    },
  });

  const autoCalcHours = () => {
    if (form.clockIn && form.clockOut) {
      const [inH, inM] = form.clockIn.split(":").map(Number);
      const [outH, outM] = form.clockOut.split(":").map(Number);
      const totalMins = (outH * 60 + outM) - (inH * 60 + inM) - Number(form.breakMinutes || 0);
      if (totalMins > 0) set("hoursWorked")((totalMins / 60).toFixed(2));
    }
  };

  const autoCalcMeters = () => {
    if (form.startChainage && form.endChainage) {
      const meters = Math.abs(Number(form.endChainage) - Number(form.startChainage));
      set("metersCompleted")(String(meters));
    }
  };

  const autoCalcAmount = () => {
    if (form.rateUsed) {
      if (form.payrollType === "hourly" && form.hoursWorked) {
        set("amountPayable")((Number(form.hoursWorked) * Number(form.rateUsed)).toFixed(2));
      } else if (form.payrollType === "piece_work" && form.metersCompleted) {
        set("amountPayable")((Number(form.metersCompleted) * Number(form.rateUsed)).toFixed(2));
      }
    }
  };

  const handleSubmit = () => {
    if (!form.jobId || !form.employeeId || !form.date || !form.workType) {
      Alert.alert("Validation", "Job, employee, date, and work type are required");
      return;
    }
    createEntry.mutate({
      data: {
        jobId: Number(form.jobId),
        employeeId: Number(form.employeeId),
        date: form.date,
        workType: form.workType as any,
        payrollType: form.payrollType as any,
        clockIn: form.clockIn || undefined,
        clockOut: form.clockOut || undefined,
        breakMinutes: Number(form.breakMinutes) || 0,
        hoursWorked: form.hoursWorked ? Number(form.hoursWorked) : undefined,
        startChainage: form.startChainage ? Number(form.startChainage) : undefined,
        endChainage: form.endChainage ? Number(form.endChainage) : undefined,
        metersCompleted: form.metersCompleted ? Number(form.metersCompleted) : undefined,
        rateUsed: form.rateUsed ? Number(form.rateUsed) : undefined,
        amountPayable: form.amountPayable ? Number(form.amountPayable) : undefined,
        notes: form.notes || undefined,
        status: "open",
      },
    });
  };

  const empInSelectedJob = employees?.filter(e =>
    !form.jobId || true
  ) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 20 }}>Add Labour Entry</Text>

      {!params.jobId && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Job *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {jobs?.map(j => (
                <TouchableOpacity key={j.id} style={{ borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: form.jobId === String(j.id) ? colors.primary : colors.muted, borderWidth: 1, borderColor: colors.border }} onPress={() => set("jobId")(String(j.id))}>
                  <Text style={{ color: form.jobId === String(j.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{(j as any).title ?? j.clientName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {user?.role !== "worker" && (
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Employee *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {employees?.map(e => (
                <TouchableOpacity key={e.id} style={{ borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: form.employeeId === String(e.id) ? colors.primary : colors.muted, borderWidth: 1, borderColor: colors.border }} onPress={() => set("employeeId")(String(e.id))}>
                  <Text style={{ color: form.employeeId === String(e.id) ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{e.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <Field label="Date (YYYY-MM-DD)" value={form.date} onChange={set("date")} colors={colors} />

      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Work Type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {WORK_TYPES.map(t => (
          <TouchableOpacity key={t.key} style={{ borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, backgroundColor: form.workType === t.key ? colors.primary : colors.muted, borderColor: colors.border }} onPress={() => set("workType")(t.key)}>
            <Text style={{ color: form.workType === t.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 12 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 8 }}>Payroll Type</Text>
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
        {PAYROLL_TYPES.map(p => (
          <TouchableOpacity key={p.key} style={{ flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", borderWidth: 1, backgroundColor: form.payrollType === p.key ? colors.secondary : colors.muted, borderColor: colors.border }} onPress={() => set("payrollType")(p.key)}>
            <Text style={{ color: form.payrollType === p.key ? "#FFF" : colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {form.payrollType === "hourly" && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Clock In (HH:MM)" value={form.clockIn} onChange={set("clockIn")} colors={colors} onBlur={autoCalcHours} /></View>
            <View style={{ flex: 1 }}><Field label="Clock Out (HH:MM)" value={form.clockOut} onChange={set("clockOut")} colors={colors} onBlur={autoCalcHours} /></View>
          </View>
          <Field label="Break (minutes)" value={form.breakMinutes} onChange={set("breakMinutes")} colors={colors} keyboard="numeric" />
          <Field label="Hours Worked" value={form.hoursWorked} onChange={set("hoursWorked")} colors={colors} keyboard="decimal-pad" onBlur={autoCalcAmount} />
        </>
      )}

      {form.payrollType === "piece_work" && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Start Chainage (m)" value={form.startChainage} onChange={set("startChainage")} colors={colors} keyboard="decimal-pad" onBlur={autoCalcMeters} /></View>
            <View style={{ flex: 1 }}><Field label="End Chainage (m)" value={form.endChainage} onChange={set("endChainage")} colors={colors} keyboard="decimal-pad" onBlur={autoCalcMeters} /></View>
          </View>
          <Field label="Meters Completed" value={form.metersCompleted} onChange={set("metersCompleted")} colors={colors} keyboard="decimal-pad" onBlur={autoCalcAmount} />
        </>
      )}

      <Field label="Rate Used (R)" value={form.rateUsed} onChange={set("rateUsed")} colors={colors} keyboard="decimal-pad" onBlur={autoCalcAmount} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <View style={{ flex: 1 }}><Field label="Amount Payable (R)" value={form.amountPayable} onChange={set("amountPayable")} colors={colors} keyboard="decimal-pad" /></View>
        <TouchableOpacity onPress={autoCalcAmount} style={{ paddingTop: 20, padding: 12 }}>
          <Feather name="refresh-cw" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <Field label="Notes (optional)" value={form.notes} onChange={set("notes")} colors={colors} multiline />

      <TouchableOpacity style={{ borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, opacity: createEntry.isPending ? 0.7 : 1, marginTop: 8 }} onPress={handleSubmit} disabled={createEntry.isPending}>
        {createEntry.isPending ? <ActivityIndicator color="#FFF" size="small" /> : (
          <><Feather name="plus-circle" size={18} color="#FFF" /><Text style={{ color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" }}>Add Entry</Text></>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, keyboard, colors, multiline, onBlur }: any) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6, color: colors.foreground }}>{label}</Text>
      <TextInput
        style={{ borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, ...(multiline ? { minHeight: 80, textAlignVertical: "top" } : {}) }}
        value={value} onChangeText={onChange} keyboardType={keyboard ?? "default"} autoCapitalize="none" multiline={multiline} onBlur={onBlur}
      />
    </View>
  );
}
