import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useBatchCreateLabourEntries, useListEmployees, useListJobs } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const WORK_TYPES = [
  { key: "trenching", label: "Trenching" },
  { key: "backfilling", label: "Backfilling" },
  { key: "cable_pulling", label: "Cable Pulling" },
  { key: "reinstatement", label: "Reinstatement" },
  { key: "manhole_installation", label: "Manhole Installation" },
  { key: "concrete", label: "Concrete" },
  { key: "other", label: "Other" },
];

type EntryDraft = {
  uid: string;
  employeeId: string;
  workType: string;
  payrollType: "hourly" | "piece_work";
  // hourly
  clockIn: string;
  clockOut: string;
  breakMinutes: string;
  hourlyRate: string;
  // piece work
  startChainage: string;
  endChainage: string;
  metersCompleted: string;
  ratePerMeter: string;
  status: "open" | "complete";
  notes: string;
};

function newEntry(): EntryDraft {
  return {
    uid: Math.random().toString(36).slice(2),
    employeeId: "",
    workType: "trenching",
    payrollType: "piece_work",
    clockIn: "",
    clockOut: "",
    breakMinutes: "0",
    hourlyRate: "",
    startChainage: "",
    endChainage: "",
    metersCompleted: "",
    ratePerMeter: "",
    status: "open",
    notes: "",
  };
}

function calcHours(clockIn: string, clockOut: string, breakMins: number): number | null {
  if (!clockIn || !clockOut) return null;
  const [ih, im] = clockIn.split(":").map(Number);
  const [oh, om] = clockOut.split(":").map(Number);
  if (isNaN(ih) || isNaN(oh)) return null;
  const diff = (oh * 60 + om) - (ih * 60 + im) - breakMins;
  return Math.max(0, diff) / 60;
}

function calcAmount(e: EntryDraft): number {
  if (e.payrollType === "hourly") {
    const h = calcHours(e.clockIn, e.clockOut, Number(e.breakMinutes || 0));
    return (h ?? 0) * Number(e.hourlyRate || 0);
  }
  if (e.payrollType === "piece_work" && e.status === "complete") {
    return Number(e.metersCompleted || 0) * Number(e.ratePerMeter || 0);
  }
  return 0;
}

export default function DailyLabourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [entries, setEntries] = useState<EntryDraft[]>([newEntry()]);
  const [empPickerIdx, setEmpPickerIdx] = useState<number | null>(null);
  const [workTypePickerIdx, setWorkTypePickerIdx] = useState<number | null>(null);

  const { data: employees } = useListEmployees();
  const fieldWorkers = employees?.filter(e => ["worker", "supervisor", "admin"].includes(e.role)) ?? [];

  const batch = useBatchCreateLabourEntries({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["labour-entries", "job", jobId] });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to save labour entries"),
    },
  });

  const updateEntry = useCallback((idx: number, patch: Partial<EntryDraft>) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }, []);

  const removeEntry = (idx: number) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const addEntry = () => {
    setEntries(prev => [...prev, newEntry()]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSave = () => {
    const invalid = entries.findIndex(e => !e.employeeId || !e.workType);
    if (invalid >= 0) {
      Alert.alert("Missing Info", `Entry ${invalid + 1}: please select an employee and work type.`);
      return;
    }
    Alert.alert(
      "Save Daily Labour",
      `Save ${entries.length} entr${entries.length === 1 ? "y" : "ies"} for ${date}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: () => batch.mutate({
            data: {
              jobId,
              date,
              supervisorId: user?.id,
              entries: entries.map(e => ({
                employeeId: Number(e.employeeId),
                workType: e.workType as any,
                payrollType: e.payrollType,
                clockIn: e.clockIn || undefined,
                clockOut: e.clockOut || undefined,
                breakMinutes: Number(e.breakMinutes || 0),
                hourlyRate: e.hourlyRate ? Number(e.hourlyRate) : undefined,
                startChainage: e.startChainage ? Number(e.startChainage) : undefined,
                endChainage: e.endChainage ? Number(e.endChainage) : undefined,
                metersCompleted: e.metersCompleted ? Number(e.metersCompleted) : undefined,
                ratePerMeter: e.ratePerMeter ? Number(e.ratePerMeter) : undefined,
                status: e.status,
                notes: e.notes || undefined,
              })),
            },
          }),
        },
      ]
    );
  };

  const grandTotal = entries.reduce((s, e) => s + calcAmount(e), 0);
  const s = makeStyles(colors);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Header — date + supervisor */}
      <View style={[s.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={s.headerRow}>
          <View style={s.headerField}>
            <Text style={[s.headerLabel, { color: colors.mutedForeground }]}>Date</Text>
            <TextInput
              style={[s.headerInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={s.headerField}>
            <Text style={[s.headerLabel, { color: colors.mutedForeground }]}>Supervisor</Text>
            <View style={[s.supervisorBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="user" size={13} color={colors.primary} />
              <Text style={[s.supervisorText, { color: colors.foreground }]}>{user?.name ?? "—"}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 }}>
        {entries.map((entry, idx) => (
          <EmployeeCard
            key={entry.uid}
            idx={idx}
            entry={entry}
            colors={colors}
            employees={fieldWorkers}
            onUpdate={patch => updateEntry(idx, patch)}
            onRemove={() => removeEntry(idx)}
            canRemove={entries.length > 1}
            onOpenEmpPicker={() => setEmpPickerIdx(idx)}
            onOpenWorkTypePicker={() => setWorkTypePickerIdx(idx)}
            s={s}
          />
        ))}

        <TouchableOpacity style={[s.addBtn, { borderColor: colors.primary }]} onPress={addEntry}>
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={[s.addBtnText, { color: colors.primary }]}>Add Employee</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={s.footerInner}>
          <View>
            <Text style={[s.footerCount, { color: colors.mutedForeground }]}>
              {entries.length} employee{entries.length !== 1 ? "s" : ""}
            </Text>
            <Text style={[s.footerAmount, { color: "#22C55E" }]}>
              Total: R {grandTotal.toFixed(2)}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: colors.primary, opacity: batch.isPending ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={batch.isPending}
          >
            {batch.isPending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Feather name="save" size={16} color="#FFF" />
                <Text style={s.saveBtnText}>Save Daily Labour</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Employee picker modal */}
      <Modal
        visible={empPickerIdx !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEmpPickerIdx(null)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setEmpPickerIdx(null)}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Select Employee</Text>
            <FlatList
              data={fieldWorkers}
              keyExtractor={e => String(e.id)}
              renderItem={({ item }) => {
                const selected = empPickerIdx !== null && entries[empPickerIdx]?.employeeId === String(item.id);
                return (
                  <TouchableOpacity
                    style={[s.modalRow, { borderBottomColor: colors.border, backgroundColor: selected ? colors.primary + "15" : "transparent" }]}
                    onPress={() => {
                      if (empPickerIdx !== null) {
                        updateEntry(empPickerIdx, { employeeId: String(item.id) });
                        // Auto-fill hourly rate from employee profile
                        const empRate = (item as any).hourlyRate;
                        if (empRate) updateEntry(empPickerIdx, { hourlyRate: String(empRate) });
                      }
                      setEmpPickerIdx(null);
                    }}
                  >
                    <View style={[s.modalAvatar, { backgroundColor: selected ? colors.primary : colors.muted }]}>
                      <Text style={{ color: selected ? "#FFF" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[s.modalRowName, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[s.modalRowSub, { color: colors.mutedForeground }]}>
                        {item.role}{(item as any).employeeNumber ? ` · ${(item as any).employeeNumber}` : ""}
                      </Text>
                    </View>
                    {selected && <Feather name="check" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 360 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Work type picker modal */}
      <Modal
        visible={workTypePickerIdx !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setWorkTypePickerIdx(null)}
      >
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setWorkTypePickerIdx(null)}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Work Performed</Text>
            {WORK_TYPES.map(wt => {
              const selected = workTypePickerIdx !== null && entries[workTypePickerIdx]?.workType === wt.key;
              return (
                <TouchableOpacity
                  key={wt.key}
                  style={[s.modalRow, { borderBottomColor: colors.border, backgroundColor: selected ? colors.primary + "15" : "transparent" }]}
                  onPress={() => {
                    if (workTypePickerIdx !== null) updateEntry(workTypePickerIdx, { workType: wt.key });
                    setWorkTypePickerIdx(null);
                  }}
                >
                  <Text style={[s.modalRowName, { color: colors.foreground }]}>{wt.label}</Text>
                  {selected && <Feather name="check" size={16} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function EmployeeCard({
  idx, entry, colors, employees, onUpdate, onRemove, canRemove,
  onOpenEmpPicker, onOpenWorkTypePicker, s,
}: {
  idx: number;
  entry: EntryDraft;
  colors: any;
  employees: any[];
  onUpdate: (patch: Partial<EntryDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
  onOpenEmpPicker: () => void;
  onOpenWorkTypePicker: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  const empName = employees.find(e => String(e.id) === entry.employeeId)?.name;
  const wtLabel = WORK_TYPES.find(w => w.key === entry.workType)?.label ?? entry.workType;
  const hours = entry.payrollType === "hourly"
    ? calcHours(entry.clockIn, entry.clockOut, Number(entry.breakMinutes || 0))
    : null;
  const amount = calcAmount(entry);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card header */}
      <View style={s.cardHeader}>
        <View style={[s.cardNum, { backgroundColor: colors.primary }]}>
          <Text style={s.cardNumText}>{idx + 1}</Text>
        </View>
        <Text style={[s.cardTitle, { color: colors.foreground }]}>Employee {idx + 1}</Text>
        {amount > 0 && (
          <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: "auto", marginRight: canRemove ? 8 : 0 }}>
            R {amount.toFixed(2)}
          </Text>
        )}
        {canRemove && (
          <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Employee selector */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Employee</Text>
      <TouchableOpacity
        style={[s.picker, { backgroundColor: colors.muted, borderColor: entry.employeeId ? colors.primary : colors.border }]}
        onPress={onOpenEmpPicker}
      >
        <Feather name="user" size={14} color={entry.employeeId ? colors.primary : colors.mutedForeground} />
        <Text style={[s.pickerText, { color: entry.employeeId ? colors.foreground : colors.mutedForeground }]}>
          {empName ?? "Select employee…"}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {/* Payroll type toggle */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Pay Type</Text>
      <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[s.toggleBtn, entry.payrollType === "piece_work" && { backgroundColor: colors.primary }]}
          onPress={() => onUpdate({ payrollType: "piece_work" })}
        >
          <Feather name="activity" size={13} color={entry.payrollType === "piece_work" ? "#FFF" : colors.mutedForeground} />
          <Text style={[s.toggleText, { color: entry.payrollType === "piece_work" ? "#FFF" : colors.mutedForeground }]}>Piece Work</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.toggleBtn, entry.payrollType === "hourly" && { backgroundColor: "#2563EB" }]}
          onPress={() => onUpdate({ payrollType: "hourly" })}
        >
          <Feather name="clock" size={13} color={entry.payrollType === "hourly" ? "#FFF" : colors.mutedForeground} />
          <Text style={[s.toggleText, { color: entry.payrollType === "hourly" ? "#FFF" : colors.mutedForeground }]}>Hourly</Text>
        </TouchableOpacity>
      </View>

      {/* Work type */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Work Performed</Text>
      <TouchableOpacity
        style={[s.picker, { backgroundColor: colors.muted, borderColor: colors.border }]}
        onPress={onOpenWorkTypePicker}
      >
        <Feather name="tool" size={14} color={colors.mutedForeground} />
        <Text style={[s.pickerText, { color: colors.foreground }]}>{wtLabel}</Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {/* Conditional fields */}
      {entry.payrollType === "piece_work" ? (
        <>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Rate Per Meter (R)</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={entry.ratePerMeter}
            onChangeText={v => onUpdate({ ratePerMeter: v })}
            keyboardType="numeric"
            placeholder="e.g. 25"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Start Chainage</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={entry.startChainage}
                onChangeText={v => onUpdate({ startChainage: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>End Chainage</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={entry.endChainage}
                onChangeText={v => onUpdate({ endChainage: v })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Meters Completed</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={entry.metersCompleted}
            onChangeText={v => onUpdate({ metersCompleted: v })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />

          {/* Status toggle */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Status</Text>
          <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[s.toggleBtn, entry.status === "open" && { backgroundColor: "#EF4444" }]}
              onPress={() => onUpdate({ status: "open" })}
            >
              <Text style={[s.toggleText, { color: entry.status === "open" ? "#FFF" : colors.mutedForeground }]}>🔵 Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, entry.status === "complete" && { backgroundColor: "#22C55E" }]}
              onPress={() => onUpdate({ status: "complete" })}
            >
              <Text style={[s.toggleText, { color: entry.status === "complete" ? "#FFF" : colors.mutedForeground }]}>✅ Completed</Text>
            </TouchableOpacity>
          </View>

          {entry.status === "open" && (
            <View style={[s.openNotice, { backgroundColor: "#EF444415" }]}>
              <Feather name="info" size={12} color="#EF4444" />
              <Text style={{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12, flex: 1 }}>
                Trench not finished — earns R0. Edit entry when complete to trigger payment.
              </Text>
            </View>
          )}
          {entry.status === "complete" && entry.metersCompleted && entry.ratePerMeter && (
            <View style={[s.calcPreview, { backgroundColor: "#22C55E15" }]}>
              <Feather name="dollar-sign" size={12} color="#22C55E" />
              <Text style={{ color: "#22C55E", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {entry.metersCompleted}m × R{entry.ratePerMeter}/m = R {(Number(entry.metersCompleted) * Number(entry.ratePerMeter)).toFixed(2)}
              </Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Hourly Rate (R/hr)</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={entry.hourlyRate}
            onChangeText={v => onUpdate({ hourlyRate: v })}
            keyboardType="numeric"
            placeholder="e.g. 75"
            placeholderTextColor={colors.mutedForeground}
          />

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock In</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={entry.clockIn}
                onChangeText={v => onUpdate({ clockIn: v })}
                placeholder="07:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock Out</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
                value={entry.clockOut}
                onChangeText={v => onUpdate({ clockOut: v })}
                placeholder="17:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Lunch Break (minutes)</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
            value={entry.breakMinutes}
            onChangeText={v => onUpdate({ breakMinutes: v })}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={colors.mutedForeground}
          />

          {hours !== null && hours > 0 && (
            <View style={[s.calcPreview, { backgroundColor: "#2563EB15" }]}>
              <Feather name="clock" size={12} color="#2563EB" />
              <Text style={{ color: "#2563EB", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>
                {hours.toFixed(2)}h × R{entry.hourlyRate}/hr = R {amount.toFixed(2)}
              </Text>
            </View>
          )}
        </>
      )}

      {/* Notes */}
      <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
      <TextInput
        style={[s.input, s.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
        value={entry.notes}
        onChangeText={v => onUpdate({ notes: v })}
        placeholder="Any notes…"
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={2}
      />
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    header: { borderBottomWidth: 1, padding: 16 },
    headerRow: { flexDirection: "row", gap: 12 },
    headerField: { flex: 1 },
    headerLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4 },
    headerInput: { borderRadius: 8, borderWidth: 1, padding: 10, fontFamily: "Inter_400Regular", fontSize: 14 },
    supervisorBox: { borderRadius: 8, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "center", gap: 6 },
    supervisorText: { fontFamily: "Inter_500Medium", fontSize: 14 },
    card: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 14 },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
    cardNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardNumText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 },
    cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    divider: { height: 1, marginVertical: 12 },
    fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 4, marginTop: 10 },
    input: { borderRadius: 8, borderWidth: 1, padding: 10, fontFamily: "Inter_400Regular", fontSize: 14 },
    inputMulti: { minHeight: 60, textAlignVertical: "top" },
    picker: { borderRadius: 8, borderWidth: 1, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    pickerText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1 },
    toggleRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
    toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 9 },
    toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
    row2: { flexDirection: "row", gap: 10 },
    calcPreview: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 10, marginTop: 8 },
    openNotice: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 8, padding: 10, marginTop: 8 },
    addBtn: { borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, marginTop: 4 },
    addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    footer: { borderTopWidth: 1, padding: 16, paddingBottom: 24 },
    footerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerCount: { fontFamily: "Inter_400Regular", fontSize: 12 },
    footerAmount: { fontFamily: "Inter_700Bold", fontSize: 18 },
    saveBtn: { borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 13 },
    saveBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 15 },
    modalOverlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 12 },
    modalRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
    modalAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    modalRowName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    modalRowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
  });
}
