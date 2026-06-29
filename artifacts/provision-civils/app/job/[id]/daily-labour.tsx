import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, FlatList,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useBatchCreateLabourEntries, useListEmployees,
  getListLabourEntriesQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import * as Haptics from "expo-haptics";

const METER_RATES = [25, 30] as const;
type MeterRate = typeof METER_RATES[number];

type MeterEntry = {
  uid: string;
  employeeId: string;
  employeeName: string;
  metersCompleted: string;
  ratePerMeter: MeterRate;
};

function uid() { return Math.random().toString(36).slice(2); }

function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

function calcHours(clockIn: string, clockOut: string): number | null {
  if (!clockIn || !clockOut) return null;
  const diff = parseTime(clockOut) - parseTime(clockIn) - 30;
  return diff > 0 ? diff / 60 : null;
}

function newMeterEntry(): MeterEntry {
  return { uid: uid(), employeeId: "", employeeName: "", metersCompleted: "", ratePerMeter: 25 };
}

export default function DailyLabourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Hourly section: shared times + which employees worked
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [hourlyEmpIds, setHourlyEmpIds] = useState<Set<number>>(new Set());

  // Per meter section: individual rows
  const [meterEntries, setMeterEntries] = useState<MeterEntry[]>([]);

  // Pickers
  const [empPickerTarget, setEmpPickerTarget] = useState<"meter" | null>(null);
  const [meterPickerUid, setMeterPickerUid] = useState<string | null>(null);

  const { data: employees } = useListEmployees();

  const batch = useBatchCreateLabourEntries({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListLabourEntriesQueryKey({ jobId }) });
        qc.invalidateQueries({ queryKey: ["labour-entries", "job", jobId] });
        router.back();
      },
      onError: (error: any) => {
        const msg: string = error?.message ?? error?.data?.error ?? "Unexpected error. Please try again.";
        setSaveError(msg);
        console.error("[daily-labour] batch save error:", error);
      },
    },
  });

  const toggleHourlyEmp = (empId: number) => {
    setHourlyEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const addMeterEntry = () => {
    setMeterEntries(prev => [...prev, newMeterEntry()]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const updateMeterEntry = useCallback((uid: string, patch: Partial<MeterEntry>) => {
    setMeterEntries(prev => prev.map(e => e.uid === uid ? { ...e, ...patch } : e));
  }, []);

  const removeMeterEntry = (uid: string) => {
    setMeterEntries(prev => prev.filter(e => e.uid !== uid));
  };

  const hours = calcHours(clockIn, clockOut);
  const hourlyAmount = hours !== null ? hours * 25 : 0;

  const meterTotal = meterEntries.reduce((sum, e) => {
    const m = Number(e.metersCompleted || 0);
    return sum + m * e.ratePerMeter;
  }, 0);

  const grandTotal = hourlyEmpIds.size * hourlyAmount + meterTotal;

  const handleSave = () => {
    if (hourlyEmpIds.size === 0 && meterEntries.length === 0) {
      Alert.alert("Nothing to Save", "Tick at least one hourly employee or add a per-meter entry.");
      return;
    }
    if (hourlyEmpIds.size > 0 && (!clockIn || !clockOut)) {
      Alert.alert("Missing Times", "Enter Clock In and Clock Out before saving hourly workers.");
      return;
    }
    const badMeter = meterEntries.find(e => !e.employeeId);
    if (badMeter) {
      Alert.alert("Missing Employee", "Select an employee for every per-meter entry.");
      return;
    }

    const allEntries = [
      ...[...hourlyEmpIds].map(empId => ({
        employeeId: empId,
        payrollType: "hourly" as const,
        clockIn: clockIn || undefined,
        clockOut: clockOut || undefined,
        status: "complete" as const,
      })),
      ...meterEntries.filter(e => e.employeeId).map(e => ({
        employeeId: Number(e.employeeId),
        payrollType: "piece_work" as const,
        metersCompleted: e.metersCompleted ? Number(e.metersCompleted) : undefined,
        ratePerMeter: e.ratePerMeter,
        status: "complete" as const,
      })),
    ];

    setSaveError(null);
    console.log("[daily-labour] saving", allEntries.length, "entries for job", jobId, "date", date);

    batch.mutate({
      data: {
        jobId,
        date,
        supervisorId: user?.id,
        entries: allEntries,
      },
    });
  };

  const s = makeStyles(colors);

  // Employees NOT already selected as hourly (to avoid duplicates in meter picker)
  const availableForMeter = (employees ?? []).filter(emp => !hourlyEmpIds.has(emp.id));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
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
        {/* ── HOURLY SECTION ── */}
        <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIcon, { backgroundColor: "#2563EB20" }]}>
              <Feather name="clock" size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Hourly Workers</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>R25/hr · 30-min lunch auto-deducted</Text>
            </View>
          </View>

          {/* Shared clock in/out */}
          <View style={[s.timeBlock, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock In</Text>
                <TextInput
                  style={[s.timeInput, { color: colors.foreground, borderColor: clockIn ? "#2563EB" : colors.border, backgroundColor: colors.background }]}
                  value={clockIn}
                  onChangeText={setClockIn}
                  placeholder="07:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
              <View style={[s.timeSep, { backgroundColor: colors.border }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Clock Out</Text>
                <TextInput
                  style={[s.timeInput, { color: colors.foreground, borderColor: clockOut ? "#2563EB" : colors.border, backgroundColor: colors.background }]}
                  value={clockOut}
                  onChangeText={setClockOut}
                  placeholder="17:00"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            </View>
            {hours !== null ? (
              <View style={s.calcRow}>
                <Feather name="check-circle" size={13} color="#2563EB" />
                <Text style={{ color: "#2563EB", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                  {hours.toFixed(2)}h × R25 = R{hourlyAmount.toFixed(2)} per employee
                </Text>
              </View>
            ) : (
              <View style={s.calcRow}>
                <Feather name="info" size={13} color={colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>
                  Enter both times to preview hours and pay
                </Text>
              </View>
            )}
          </View>

          {/* Employee checkboxes */}
          <Text style={[s.pickLabel, { color: colors.mutedForeground }]}>
            {hourlyEmpIds.size === 0 ? "Tick employees who worked hourly today:" : `${hourlyEmpIds.size} employee${hourlyEmpIds.size !== 1 ? "s" : ""} selected:`}
          </Text>
          {(employees ?? []).map(emp => {
            const sel = hourlyEmpIds.has(emp.id);
            return (
              <TouchableOpacity
                key={emp.id}
                style={[s.empRow, { borderColor: sel ? "#2563EB" : colors.border, backgroundColor: sel ? "#2563EB10" : colors.muted }]}
                onPress={() => toggleHourlyEmp(emp.id)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, { borderColor: sel ? "#2563EB" : colors.border, backgroundColor: sel ? "#2563EB" : "transparent" }]}>
                  {sel && <Feather name="check" size={12} color="#FFF" />}
                </View>
                <View style={[s.empAvatar, { backgroundColor: sel ? "#2563EB20" : colors.border + "40" }]}>
                  <Text style={{ color: sel ? "#2563EB" : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    {emp.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[s.empName, { color: colors.foreground, flex: 1 }]}>{emp.name}</Text>
                {sel && hours !== null && (
                  <Text style={{ color: "#2563EB", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    R{hourlyAmount.toFixed(2)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
          {(employees ?? []).length === 0 && (
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", paddingVertical: 12 }}>
              No employees found
            </Text>
          )}
        </View>

        {/* ── PER METER SECTION ── */}
        <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
          <View style={s.sectionHeader}>
            <View style={[s.sectionIcon, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="activity" size={16} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Per Meter Workers</Text>
              <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>Each employee entered individually</Text>
            </View>
          </View>

          {meterEntries.map((entry, idx) => (
            <MeterCard
              key={entry.uid}
              idx={idx}
              entry={entry}
              colors={colors}
              s={s}
              onUpdate={patch => updateMeterEntry(entry.uid, patch)}
              onRemove={() => removeMeterEntry(entry.uid)}
              onOpenEmpPicker={() => { setEmpPickerTarget("meter"); setMeterPickerUid(entry.uid); }}
            />
          ))}

          {meterEntries.length === 0 && (
            <View style={[s.emptyHint, { backgroundColor: colors.muted }]}>
              <Feather name="info" size={13} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 13, flex: 1 }}>
                No per-meter entries yet. Tap below to add.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.addBtn, { borderColor: "#8B5CF6" }]}
            onPress={addMeterEntry}
          >
            <Feather name="plus" size={16} color="#8B5CF6" />
            <Text style={{ color: "#8B5CF6", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Add Per Meter Employee</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {/* Error banner — shown inline, never blocks with a modal */}
        {saveError !== null && (
          <View style={s.errorBanner}>
            <Feather name="alert-circle" size={14} color="#FFF" />
            <Text style={s.errorBannerText} numberOfLines={3}>{saveError}</Text>
            <TouchableOpacity onPress={() => setSaveError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={s.footerInner}>
          <View>
            <Text style={[s.footerCount, { color: colors.mutedForeground }]}>
              {hourlyEmpIds.size + meterEntries.length} entr{(hourlyEmpIds.size + meterEntries.length) !== 1 ? "ies" : "y"}
            </Text>
            <Text style={[s.footerTotal, { color: "#22C55E" }]}>R {grandTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: colors.primary, opacity: batch.isPending ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={batch.isPending}
          >
            {batch.isPending ? (
              <><ActivityIndicator color="#FFF" size="small" /><Text style={s.saveBtnText}>Saving…</Text></>
            ) : (
              <><Feather name="save" size={16} color="#FFF" /><Text style={s.saveBtnText}>Save</Text></>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Employee picker for per-meter rows */}
      <Modal
        visible={empPickerTarget === "meter" && meterPickerUid !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setEmpPickerTarget(null); setMeterPickerUid(null); }}
      >
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => { setEmpPickerTarget(null); setMeterPickerUid(null); }}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Select Employee (Per Meter)</Text>
            <FlatList
              data={availableForMeter}
              keyExtractor={e => String(e.id)}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={
                <Text style={{ color: colors.mutedForeground, textAlign: "center", padding: 24, fontFamily: "Inter_400Regular" }}>
                  All employees already assigned as hourly
                </Text>
              }
              renderItem={({ item }) => {
                const current = meterEntries.find(e => e.uid === meterPickerUid);
                const sel = current?.employeeId === String(item.id);
                return (
                  <TouchableOpacity
                    style={[s.sheetRow, { borderBottomColor: colors.border, backgroundColor: sel ? colors.primary + "15" : "transparent" }]}
                    onPress={() => {
                      if (meterPickerUid) updateMeterEntry(meterPickerUid, { employeeId: String(item.id), employeeName: item.name });
                      setEmpPickerTarget(null);
                      setMeterPickerUid(null);
                    }}
                  >
                    <View style={[s.empAvatar, { backgroundColor: sel ? colors.primary + "30" : colors.border + "40" }]}>
                      <Text style={{ color: sel ? colors.primary : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 13 }}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[s.empName, { color: colors.foreground, flex: 1 }]}>{item.name}</Text>
                    {sel && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MeterCard({
  idx, entry, colors, s, onUpdate, onRemove, onOpenEmpPicker,
}: {
  idx: number;
  entry: MeterEntry;
  colors: any;
  s: ReturnType<typeof makeStyles>;
  onUpdate: (patch: Partial<MeterEntry>) => void;
  onRemove: () => void;
  onOpenEmpPicker: () => void;
}) {
  const meters = Number(entry.metersCompleted || 0);
  const amount = meters * entry.ratePerMeter;

  return (
    <View style={[s.meterCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View style={[s.meterNum, { backgroundColor: "#8B5CF6" }]}>
          <Text style={{ color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 11 }}>{idx + 1}</Text>
        </View>
        {meters > 0 && (
          <Text style={{ color: "#22C55E", fontFamily: "Inter_700Bold", fontSize: 13, marginLeft: "auto", marginRight: 8 }}>
            R{amount.toFixed(2)}
          </Text>
        )}
        <TouchableOpacity onPress={onRemove} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x-circle" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Employee picker */}
      <TouchableOpacity
        style={[s.picker, { backgroundColor: colors.background, borderColor: entry.employeeId ? "#8B5CF6" : colors.border }]}
        onPress={onOpenEmpPicker}
      >
        <Feather name="user" size={14} color={entry.employeeId ? "#8B5CF6" : colors.mutedForeground} />
        <Text style={[s.pickerText, { color: entry.employeeId ? colors.foreground : colors.mutedForeground }]}>
          {entry.employeeName || "Select employee…"}
        </Text>
        <Feather name="chevron-down" size={14} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      <View style={[s.meterFields, { marginTop: 10 }]}>
        {/* Meters input */}
        <View style={{ flex: 1 }}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Meters</Text>
          <TextInput
            style={[s.meterInput, { color: colors.foreground, borderColor: entry.metersCompleted ? "#8B5CF6" : colors.border, backgroundColor: colors.background }]}
            value={entry.metersCompleted}
            onChangeText={v => onUpdate({ metersCompleted: v })}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Rate toggle */}
        <View style={{ flex: 1 }}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Rate/m</Text>
          <View style={[s.rateRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
            {METER_RATES.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.rateBtn, entry.ratePerMeter === r && { backgroundColor: "#8B5CF6" }]}
                onPress={() => onUpdate({ ratePerMeter: r })}
              >
                <Text style={[s.rateBtnText, { color: entry.ratePerMeter === r ? "#FFF" : colors.foreground }]}>
                  R{r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {meters > 0 && (
        <View style={[s.calcRow, { marginTop: 8 }]}>
          <Feather name="check-circle" size={13} color="#8B5CF6" />
          <Text style={{ color: "#8B5CF6", fontFamily: "Inter_700Bold", fontSize: 12 }}>
            {meters}m × R{entry.ratePerMeter} = R{amount.toFixed(2)}
          </Text>
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

    sectionCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    sectionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
    sectionSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },

    timeBlock: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
    timeRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
    timeSep: { width: 1, height: 40, marginBottom: 8 },
    fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 6 },
    timeInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_600SemiBold", fontSize: 16, textAlign: "center" },
    calcRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },

    pickLabel: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 8 },
    empRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 6 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    empAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    empName: { fontFamily: "Inter_500Medium", fontSize: 14 },

    emptyHint: { flexDirection: "row", gap: 8, borderRadius: 10, padding: 12, marginBottom: 12, alignItems: "flex-start" },

    meterCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10 },
    meterNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
    meterFields: { flexDirection: "row", gap: 10 },
    meterInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontFamily: "Inter_400Regular", fontSize: 15 },

    picker: { borderRadius: 10, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
    pickerText: { fontFamily: "Inter_400Regular", fontSize: 14 },
    rateRow: { flexDirection: "row", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
    rateBtn: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    rateBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", paddingVertical: 14, marginTop: 4 },

    footer: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16 },
    errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EF4444", borderRadius: 10, padding: 12, marginBottom: 10 },
    errorBannerText: { color: "#FFF", fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
    footerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footerCount: { fontFamily: "Inter_400Regular", fontSize: 13 },
    footerTotal: { fontFamily: "Inter_700Bold", fontSize: 20 },
    saveBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
    saveBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 15 },

    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
    sheetTitle: { fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 16 },
    sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1 },
  });
}
