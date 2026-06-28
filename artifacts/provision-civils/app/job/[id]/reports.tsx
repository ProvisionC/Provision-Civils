import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
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

export default function DailyReportsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: reports, isLoading } = useListDailyReports(jobId, {
    query: { queryKey: getListDailyReportsQueryKey(jobId) },
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], notes: "", progressNotes: "" });

  const createReport = useCreateDailyReport({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListDailyReportsQueryKey(jobId) });
        setShowModal(false);
        setForm({ date: new Date().toISOString().split("T")[0], notes: "", progressNotes: "" });
      },
      onError: () => Alert.alert("Error", "Failed to create report"),
    },
  });

  const handleSubmit = () => {
    if (!form.date) { Alert.alert("Validation", "Date is required"); return; }
    createReport.mutate({ id: jobId, data: { date: form.date, notes: form.notes || undefined, progressNotes: form.progressNotes || undefined } });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
          <Feather name="plus" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : reports?.length === 0 ? (
        <View style={styles.center}>
          <Feather name="clipboard" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No reports yet</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
            <Text style={styles.emptyBtnText}>Add First Report</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.date, { color: colors.primary }]}>
                  {new Date(item.date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleTimeString()}
                </Text>
              </View>
              {item.progressNotes && (
                <View>
                  <Text style={[styles.fieldTitle, { color: colors.foreground }]}>Progress</Text>
                  <Text style={[styles.fieldText, { color: colors.mutedForeground }]}>{item.progressNotes}</Text>
                </View>
              )}
              {item.notes && (
                <View>
                  <Text style={[styles.fieldTitle, { color: colors.foreground }]}>Notes</Text>
                  <Text style={[styles.fieldText, { color: colors.mutedForeground }]}>{item.notes}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Daily Report</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={[styles.label, { color: colors.foreground }]}>Date</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
              value={form.date}
              onChangeText={v => setForm(f => ({ ...f, date: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.label, { color: colors.foreground }]}>Progress Notes</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
              value={form.progressNotes}
              onChangeText={v => setForm(f => ({ ...f, progressNotes: v }))}
              placeholder="Describe progress made today..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <Text style={[styles.label, { color: colors.foreground }]}>Additional Notes</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, styles.multiline]}
              value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Any other notes..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, createReport.isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={createReport.isPending}
            >
              {createReport.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.submitText}>Save Report</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { fontSize: 14, fontFamily: "Inter_700Bold", flex: 1 },
  time: { fontSize: 12, fontFamily: "Inter_400Regular" },
  fieldTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  fieldText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalBody: { padding: 20, gap: 12 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
