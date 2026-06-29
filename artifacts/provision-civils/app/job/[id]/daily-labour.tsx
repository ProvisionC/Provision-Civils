import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useBatchCreateLabourEntries, useListEmployees } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const WORK_TYPES = [
  { key: "trenching", label: "Trenching" },
  { key: "backfilling", label: "Backfilling" },
  { key: "cable_pulling", label: "Cable Pulling" },
  { key: "reinstatement", label: "Reinstatement" },
  { key: "manhole_installation", label: "Manhole Install." },
  { key: "concrete", label: "Concrete" },
  { key: "other", label: "Other" },
];

const METER_RATES = [25, 30] as const;
type MeterRate = typeof METER_RATES[number];

type EntryDraft = {
  uid: string;
  employeeId: string;
  employeeName: string;
  payrollType: "hourly" | "piece_work" | null;
  workType: string;
  // hourly
  clockIn: string;
  clockOut: string;
  // piece work
  metersCompleted: string;
  ratePerMeter: MeterRate;
  status: "open" | "complete";
  notes: string;
};

function newEntry(): EntryDraft {
  return {
    uid: Math.random().toString(36).slice(2),
    employeeId: "",
    employeeName: "",
    payrollType: null,
    workType: "trenching",
    clockIn: "",
    clockOut: "",
    metersCompleted: "",
    ratePerMeter: 25,
    status: "open",
    notes: "",
  };
}

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function calcHours(clockIn: string, clockOut: string): number | null {
  if (!clockIn || !clockOut) return null;
  const diff = parseTime(clockOut) - parseTime(clockIn) - 30; // 30 min fixed break
  return diff > 0 ? diff / 60 : null;
}

function calcAmount(e: EntryDraft): number {
  if (e.payrollType === "hourly") {
    const h = calcHours(e.clockIn, e.clockOut);
    return (h ?? 0) * 25; // R25/hr fixed
  }
  if (e.payrollType === "piece_work" && e.status === "complete") {
    return Number(e.metersCompleted || 0) * e.ratePerMeter;
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

  const batch = useBatchCreateLabourEntries({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: ["labour-entries", "job", jobId] });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to save entries. Please try again."),
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
    const invalid = entries.findIndex(e => !e.employeeId);
    if (invalid >= 0) {
      Alert.alert("Missing Employee", `Entry ${invalid + 1}: please select an employee.`);
      return;
    }
    const readyCount = entries.length;
    Alert.alert(
      "Save Daily Labour",
      `Save ${readyCount} entr${readyCount === 1 ? "y" : "ies"} for ${date}?`,
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
                clockIn: e.clockIn || undefined,
                clockOut: e.clockOut || undefined,
                metersCompleted: e.metersCompleted ? Number(e.metersCompleted) : undefined,
                ratePerMeter: e.payrollType === "piece_work" ? e.ratePerMeter : undefined,
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
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Date + supervisor header */}
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
            employees={employees ?? []}
            onUpdate={patch => updateEntry(idx, patch)}
            onRemove={() => removeEntry(idx)}
            canRemove={entries.length > 1}
            onOpenEmpPicker={() => setEmpPickerIdx(idx)}
            onOpenWorkTypePicker={() => setWorkTypePickerIdx(idx)}
            s={s}
          />
        ))}

        <TouchableOpacity style={[s.addBtn, { borderColor: colors.primary }]} onPress={addEntry}>
          <Feather name="plus" size={18} color={colors.primary} />
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
            <Text style={[s.footerTotal, { color: "#22C55E" }]}>R {grandTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: colors.primary, opacity: batch.isPending ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={batch.isPending}
          >
            {batch.isPending
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><Feather name="save" size={16} color="#FFF" /><Text style={s.saveBtnText}>Save</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* Employee picker */}
      <Modal visible={empPickerIdx !== null} transparent animationType="slide" onRequestClose={() => setEmpPickerIdx(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setEmpPickerIdx(null)}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Select Employee</Text>
            <FlatList
              data={employees}
              keyExtractor={e => String(e.id)}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const sel = empPickerIdx !== null && entries[empPickerIdx]?.employeeId === String(item.id);
                const isHourly = (item as any).payrollType === "hourly";
                return (
                  <TouchableOpacity
                    style={[s.empRow, { borderBottomColor: colors.border, backgroundColor: sel ? colors.primary + "15" : "transparent" }]}
                    onPress={() => {
                      if (empPickerIdx !== null) {
                        updateEntry(empPickerIdx, {
                          employeeId: String(item.id),
                          employeeName: item.name,
                          payrollType: (item as any).payrollType ?? "hourly",
                        });
                      }
                      setEmpPickerIdx(null);
                    }}
                  >
                    <View style={[s.empAvatar, { backgroundColor: sel ? colors.primary : (isHourly ? "#2563EB20" : "#8B5CF620") }]}>
                      <Text style={{ color: sel ? "#FFF" : (isHourly ? "#2563EB" : "#8B5CF6"), fontFamily: "Inter_700Bold", fontSize: 14 }}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.empName, { color: colors.foreground }]}>{item.name}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <View style={[s.typeBadge, { backgroundColor: isHourly ? "#2563EB20" : "#8B5CF620" }]}>
                          <Feather name={isHourly ? "clock" : "activity"} size={10} color={isHourly ? "#2563EB" : "#8B5CF6"} />
                          <Text style={{ color: isHourly ? "#2563EB" : "#8B5CF6", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                            {isHourly ? "Hourly · R25/hr" : "Piece Work"}
                          </Text>
                        </View>
                        {(item as any).employeeNumber && (
                          <Text style={[s.empSub, { color: colors.mutedForeground }]}>#{(item as any).employeeNumber}</Text>
                        )}
                      </View>
                    </View>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Work type picker */}
      <Modal visible={workTypePickerIdx !== null} transparent animationType="slide" onRequestClose={() => setWorkTypePickerIdx(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setWorkTypePickerIdx(null)}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Work Performed</Text>
            {WORK_TYPES.map(wt => {
              const sel = workTypePickerIdx !== null && entries[workTypePickerIdx]?.workType === wt.key;
              return (
                <TouchableOpacity
                  key={wt.key}
                  style={[s.wtRow, { borderBottomColor: colors.border, backgroundColor: sel ? colors.primary + "15" : "transparent" }]}
                  onPress={() => {
                    if (workTypePickerIdx !== null) updateEntry(workTypePickerIdx, { workType: wt.key });
                    setWorkTypePickerIdx(null);
                  }}
                >
                  <Text style={[s.wtLabel, { color: colors.foreground }]}>{wt.label}</Text>
                  {sel && <Feather name="check" size={16} color={colors.primary} />}
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
  const isPiece = entry.payrollType === "piece_work";
  const isHourly = entry.payrollType === "hourly";
  const hours = isHourly ? calcHours(entry.clockIn, entry.clockOut) : null;
  const amount = calcAmount(entry);
  const wtLabel = WORK_TYPES.find(w => w.key === entry.workType)?.label ?? entry.workType;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Card header */}
      <View style={s.cardHeader}>
        <View style={[s.cardNum, { backgroundColor: colors.primary }]}>
          <Text style={s.cardNumText}>{idx + 1}</Text>
        </View>
        {entry.payrollType && (
          <View style={[s.typePill, { backgroundColor: isHourly ? "#2563EB20" : "#8B5CF620" }]}>
            <Feather name={isHourly ? "clock" : "activity"} size={11} color={isHourly ? "#2563EB" : "#8B5CF6"} />
            <Text style={{ color: isHourly ? "#2563EB" : "#8B5CF6", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>
              {isHourly ? "Hourly" : "Piece Work"}
            </Text>
          </View>
        )}
        {amount > 0 && (
          <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 14, marginLeft: "auto", marginRight: canRemove ? 8 : 0 }}>
            R {amount.toFixed(2)}
          </Text>
        )}
        {canRemove && (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Employee selector */}
      <TouchableOpacity
        style={[s.picker, { backgroundColor: colors.muted, borderColor: entry.employeeId ? colors.primary : colors.border }]}
        onPress={onOpenEmpPicker}
      >
        <Feather name="user" size={15} color={entry.employeeId ? colors.primary : colors.mutedForeground} />
        <Text style={[s.pickerText, { color: entry.employeeId ? colors.foreground : colors.mutedForeground }]}>
          {entry.employeeName || "Select employee…"}
        </Text>
        <Feather name="chevron-down" size={15} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {/* Work type selector */}
      <TouchableOpacity
        style={[s.picker, { backgroundColor: colors.muted, borderColor: colors.border, marginTop: 8 }]}
        onPress={onOpenWorkTypePicker}
      >
        <Feather name="tool" size={15} color={colors.mutedForeground} />
        <Text style={[s.pickerText, { color: colors.foreground }]}>{wtLabel}</Text>
        <Feather name="chevron-down" size={15} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {/* Fields based on payroll type — only shown once employee is selected */}
      {!entry.payrollType && entry.employeeId === "" && (
        <View style={[s.hintBox, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={[s.hintText, { color: colors.mutedForeground }]}>Select an employee to see pay fields</Text>
        </View>
      )}

      {isHourly && (
        <View style={{ marginTop: 12 }}>
          {/* Auto-rate notice */}
          <View style={[s.autoBox, { backgroundColor: "#2563EB10", borderColor: "#2563EB30" }]}>
            <Feather name="info" size={12} color="#2563EB" />
            <Text style={{ color: "#2563EB", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 }}>
              R25/hr · 30-min lunch deducted automatically
            </Text>
          </View>

          <View style={[s.timeRow, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock In</Text>
              <TextInput
                style={[s.timeInput, { color: colors.foreground, borderColor: entry.clockIn ? colors.primary : colors.border, backgroundColor: colors.muted }]}
                value={entry.clockIn}
                onChangeText={v => onUpdate({ clockIn: v })}
                placeholder="07:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={[s.timeSep, { backgroundColor: colors.border }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock Out</Text>
              <TextInput
                style={[s.timeInput, { color: colors.foreground, borderColor: entry.clockOut ? colors.primary : colors.border, backgroundColor: colors.muted }]}
                value={entry.clockOut}
                onChangeText={v => onUpdate({ clockOut: v })}
                placeholder="17:00"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          {hours !== null && (
            <View style={[s.calcPreview, { backgroundColor: "#2563EB10" }]}>
              <Feather name="clock" size={13} color="#2563EB" />
              <Text style={{ color: "#2563EB", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {hours.toFixed(2)}h × R25 = R {(hours * 25).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}

      {isPiece && (
        <View style={{ marginTop: 12 }}>
          {/* Rate selector */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Rate Per Meter</Text>
          <View style={[s.rateRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {METER_RATES.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rateBtn, entry.ratePerMeter === r && { backgroundColor: colors.primary }]}
                onPress={() => onUpdate({ ratePerMeter: r })}
              >
                <Text style={[s.rateBtnText, { color: entry.ratePerMeter === r ? "#FFF" : colors.foreground }]}>
                  R{r}/m
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Meters */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Meters Completed</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: entry.metersCompleted ? colors.primary : colors.border, backgroundColor: colors.muted }]}
            value={entry.metersCompleted}
            onChangeText={v => onUpdate({ metersCompleted: v })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />

          {/* Status */}
          <Text style={[s.fieldLabel, { color: colors.mutedForeground, marginTop: 10 }]}>Status</Text>
          <View style={[s.rateRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[s.rateBtn, entry.status === "open" && { backgroundColor: "#F59E0B" }]}
              onPress={() => onUpdate({ status: "open" })}
            >
              <Text style={[s.rateBtnText, { color: entry.status === "open" ? "#FFF" : colors.foreground }]}>
                Incomplete
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.rateBtn, entry.status === "complete" && { backgroundColor: "#22C55E" }]}
              onPress={() => onUpdate({ status: "complete" })}
            >
              <Text style={[s.rateBtnText, { color: entry.status === "complete" ? "#FFF" : colors.foreground }]}>
                Completed
              </Text>
            </TouchableOpacity>
          </View>

          {entry.status === "open" && (
            <View style={[s.autoBox, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B30", marginTop: 8 }]}>
              <Feather name="clock" size={12} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 }}>
                Incomplete — earns R0. Mark Completed when the trench is finished.
              </Text>
            </View>
          )}

          {entry.status === "complete" && entry.metersCompleted && (
            <View style={[s.calcPreview, { backgroundColor: "#22C55E10" }]}>
              <Feather name="check-circle" size={13} color="#22C55E" />
              <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                {entry.metersCompleted}m × R{entry.ratePerMeter} = R {(Number(entry.metersCompleted) * entry.ratePerMeter).toFixed(2)}
              </Text>
            </View>
          )}
        </View>
      )}
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
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    cardNumText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 12 },
    typePill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    divider: { height: 1, marginVertical: 12 },

    picker: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    pickerText: { fontFamily: "Inter_400Regular", fontSize: 14, flex: 1 },

    hintBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10, marginTop: 10 },
    hintText: { fontFamily: "Inter_400Regular", fontSize: 12 },

    autoBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
    fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
    timeRow: { flexDirection: "row", alignItems: "flex-end", gap: 0 },
    timeSep: { width: 1, height: 36, marginHorizontal: 8, alignSelf: "flex-end", marginBottom: 10 },
    timeInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontFamily: "Inter_600SemiBold", fontSize: 18, textAlign: "center" },
    calcPreview: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 10, marginTop: 8 },

    input: { borderRadius: 10, borderWidth: 1, padding: 12, fontFamily: "Inter_600SemiBold", fontSize: 18 },
    rateRow: { flexDirection: "row", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
    rateBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 9 },
    rateBtnText: { fontFamily: "Inter_700Bold", fontSize: 15 },

    addBtn: { borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, marginTop: 4 },
    addBtnText: { fontFamily: "Inter_700Bold", fontSize: 16 },

    footer: { borderTopWidth: 1, padding: 16, paddingBottom: 28 },
    footerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerCount: { fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 2 },
    footerTotal: { fontFamily: "Inter_700Bold", fontSize: 22 },
    saveBtn: { borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14 },
    saveBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 },

    overlay: { flex: 1, backgroundColor: "#00000060", justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36 },
    handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
    sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 18, marginBottom: 12 },
    empRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
    empAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    empName: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
    empSub: { fontFamily: "Inter_400Regular", fontSize: 12 },
    typeBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    wtRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16, borderBottomWidth: 1, paddingHorizontal: 4 },
    wtLabel: { fontFamily: "Inter_500Medium", fontSize: 16 },
  });
}
