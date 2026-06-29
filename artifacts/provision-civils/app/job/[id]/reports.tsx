import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
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

const TODAY = new Date().toISOString().split("T")[0];

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
          <Feather name="plus" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>New Report</Text>
        </TouchableOpacity>
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
                  <ReportSection colors={colors} icon="file-text" title="Additional Notes" text={item.notes} />
                )}
              </View>
            );
          }}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Supervisor Daily Report</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
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

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Work Completed Today *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
                value={form.workCompleted}
                onChangeText={v => setForm(f => ({ ...f, workCompleted: v }))}
                placeholder="Describe all work completed today..."
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Labour on Site</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.labourOnSite}
                onChangeText={v => setForm(f => ({ ...f, labourOnSite: v }))}
                placeholder="e.g. 4 workers, 1 operator"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Problems / Delays Encountered</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
                value={form.problemsEncountered}
                onChangeText={v => setForm(f => ({ ...f, problemsEncountered: v }))}
                placeholder="Any problems, delays, or safety issues encountered..."
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Tomorrow's Planned Work</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
                value={form.tomorrowWork}
                onChangeText={v => setForm(f => ({ ...f, tomorrowWork: v }))}
                placeholder="Describe planned work for tomorrow..."
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

            <View>
              <Text style={[styles.label, { color: colors.foreground }]}>Additional Notes</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
                value={form.notes}
                onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Any other remarks..."
                placeholderTextColor={colors.mutedForeground}
                multiline
              />
            </View>

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
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
