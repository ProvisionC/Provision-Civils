import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useListDailyReports, useCreateDailyReport,
  getListDailyReportsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useSpeechToText } from "@/hooks/useSpeechToText";

const TODAY = new Date().toISOString().split("T")[0];

type FieldKey = "workCompleted" | "labourOnSite" | "problemsEncountered" | "tomorrowWork" | "notes";

export default function DailyReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor" || user?.role === "admin" || user?.role === "project_manager";

  const { data: reports, isLoading } = useListDailyReports(jobId, {
    query: { queryKey: getListDailyReportsQueryKey(jobId) },
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: TODAY,
    workCompleted: "",
    problemsEncountered: "",
    tomorrowWork: "",
    labourOnSite: "",
    notes: "",
    progressNotes: "",
  });

  const [activeField, setActiveField] = useState<FieldKey | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { isListening, isAvailable, partialTranscript, startListening, stopListening } = useSpeechToText();

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const handleMicPress = async (field: FieldKey) => {
    if (!isAvailable) {
      Alert.alert(
        "Voice Not Available",
        "Speech recognition is not available on this device or browser. Please type your notes manually.",
        [{ text: "OK" }]
      );
      return;
    }

    if (isListening && activeField === field) {
      stopListening();
      stopPulse();
      setActiveField(null);
      return;
    }

    if (isListening) {
      stopListening();
      stopPulse();
    }

    setActiveField(field);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startPulse();

    await startListening((text) => {
      setForm(f => ({
        ...f,
        [field]: f[field as keyof typeof f]
          ? (f[field as keyof typeof f] as string).trim() + " " + text
          : text,
      }));
      stopPulse();
      setActiveField(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, "af-ZA");
  };

  const createReport = useCreateDailyReport({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey(jobId) });
        setShowModal(false);
        setForm({ date: TODAY, workCompleted: "", problemsEncountered: "", tomorrowWork: "", labourOnSite: "", notes: "", progressNotes: "" });
      },
      onError: () => Alert.alert("Error", "Failed to create report"),
    },
  });

  const handleSubmit = () => {
    if (!form.date) { Alert.alert("Validation", "Date is required"); return; }
    if (isListening) stopListening();
    createReport.mutate({
      id: jobId,
      data: {
        date: form.date,
        workCompleted: form.workCompleted || undefined,
        problemsEncountered: form.problemsEncountered || undefined,
        tomorrowWork: form.tomorrowWork || undefined,
        labourOnSite: form.labourOnSite || undefined,
        notes: form.notes || undefined,
        progressNotes: form.progressNotes || undefined,
      },
    });
  };

  const handleModalClose = () => {
    if (isListening) stopListening();
    stopPulse();
    setActiveField(null);
    setShowModal(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""}
        </Text>
        {isSupervisor && (
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
            <Feather name="plus" size={18} color="#FFF" />
            <Text style={styles.addBtnText}>New Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (reports?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No reports yet</Text>
          {isSupervisor && (
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
              <Text style={styles.emptyBtnText}>Add First Report</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const r = item as any;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.dateBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="calendar" size={13} color={colors.primary} />
                    <Text style={[styles.date, { color: colors.primary }]}>
                      {new Date(item.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>
                    {new Date(item.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
                {(r.workCompleted || item.progressNotes) && (
                  <ReportSection colors={colors} icon="check-square" title="Work Completed" text={r.workCompleted || item.progressNotes} />
                )}
                {r.problemsEncountered && (
                  <ReportSection colors={colors} icon="alert-triangle" title="Problems Encountered" text={r.problemsEncountered} iconColor="#E65100" />
                )}
                {r.tomorrowWork && (
                  <ReportSection colors={colors} icon="arrow-right-circle" title="Tomorrow's Work" text={r.tomorrowWork} />
                )}
                {r.labourOnSite && (
                  <ReportSection colors={colors} icon="users" title="Labour on Site" text={r.labourOnSite} />
                )}
                {item.notes && (
                  <ReportSection colors={colors} icon="mic" title="Voice / Additional Notes" text={item.notes} />
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleModalClose}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Supervisor Daily Report</Text>
              {isListening && (
                <View style={styles.listeningBanner}>
                  <Animated.View style={[styles.listeningDot, { transform: [{ scale: pulseAnim }] }]} />
                  <Text style={styles.listeningText}>
                    Listening{partialTranscript ? `: ${partialTranscript}` : "… (Afrikaans / English)"}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleModalClose}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Date */}
            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Date *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.date}
                onChangeText={v => setForm(f => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <VoiceField
              label="Work Completed Today *"
              value={form.workCompleted}
              onChangeText={v => setForm(f => ({ ...f, workCompleted: v }))}
              placeholder="Describe all work completed today…"
              field="workCompleted"
              activeField={activeField}
              isListening={isListening}
              onMicPress={handleMicPress}
              colors={colors}
              pulseAnim={pulseAnim}
            />

            <VoiceField
              label="Labour on Site"
              value={form.labourOnSite}
              onChangeText={v => setForm(f => ({ ...f, labourOnSite: v }))}
              placeholder="e.g. 4 workers, 1 operator"
              field="labourOnSite"
              activeField={activeField}
              isListening={isListening}
              onMicPress={handleMicPress}
              colors={colors}
              pulseAnim={pulseAnim}
              multiline={false}
            />

            <VoiceField
              label="Problems / Delays Encountered"
              value={form.problemsEncountered}
              onChangeText={v => setForm(f => ({ ...f, problemsEncountered: v }))}
              placeholder="Any problems, delays, or safety issues…"
              field="problemsEncountered"
              activeField={activeField}
              isListening={isListening}
              onMicPress={handleMicPress}
              colors={colors}
              pulseAnim={pulseAnim}
            />

            <VoiceField
              label="Tomorrow's Planned Work"
              value={form.tomorrowWork}
              onChangeText={v => setForm(f => ({ ...f, tomorrowWork: v }))}
              placeholder="Describe planned work for tomorrow…"
              field="tomorrowWork"
              activeField={activeField}
              isListening={isListening}
              onMicPress={handleMicPress}
              colors={colors}
              pulseAnim={pulseAnim}
            />

            <VoiceField
              label="Voice Notes / Additional Remarks"
              value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Tap the mic and speak in Afrikaans or English…"
              field="notes"
              activeField={activeField}
              isListening={isListening}
              onMicPress={handleMicPress}
              colors={colors}
              pulseAnim={pulseAnim}
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, createReport.isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={createReport.isPending}
            >
              {createReport.isPending
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Feather name="check" size={18} color="#FFF" />
                    <Text style={styles.submitText}>Submit Report</Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

interface VoiceFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  field: FieldKey;
  activeField: FieldKey | null;
  isListening: boolean;
  onMicPress: (field: FieldKey) => void;
  colors: any;
  pulseAnim: Animated.Value;
  multiline?: boolean;
}

function VoiceField({
  label, value, onChangeText, placeholder,
  field, activeField, isListening, onMicPress,
  colors, pulseAnim, multiline = true,
}: VoiceFieldProps) {
  const isActive = isListening && activeField === field;
  const micColor = isActive ? "#E53935" : colors.primary;
  const borderColor = isActive ? "#E53935" : colors.border;

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: isActive ? "#FFEBEE" : colors.primary + "15", borderColor }]}
          onPress={() => onMicPress(field)}
          activeOpacity={0.7}
        >
          {isActive ? (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Feather name="mic" size={14} color="#E53935" />
            </Animated.View>
          ) : (
            <Feather name="mic" size={14} color={colors.primary} />
          )}
          <Text style={[styles.micLabel, { color: isActive ? "#E53935" : colors.primary }]}>
            {isActive ? "Stop" : "Dictate"}
          </Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.input, borderColor: isActive ? "#E53935" : colors.border, color: colors.foreground },
          multiline && styles.multiline,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
      />
    </View>
  );
}

function ReportSection({ colors, icon, title, text, iconColor }: {
  colors: any; icon: string; title: string; text: string; iconColor?: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Feather name={icon as any} size={13} color={iconColor ?? colors.primary} />
        <Text style={[styles.sectionTitle, { color: iconColor ?? colors.primary }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: "#FFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  date: { fontSize: 13, fontFamily: "Inter_700Bold" },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  section: { gap: 4 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_700Bold" },
  sectionText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginLeft: 19 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  listeningBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  listeningDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E53935" },
  listeningText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#E53935", maxWidth: 240 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  micBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  micLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
