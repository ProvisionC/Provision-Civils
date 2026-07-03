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
  useListJobExpenses, useCreateJobExpense, useDeleteJobExpense,
  getListJobExpensesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = [
  { key: "fuel", label: "Fuel" },
  { key: "diesel", label: "Diesel" },
  { key: "accommodation", label: "Accommodation" },
  { key: "labour", label: "Labour" },
  { key: "plant_hire", label: "Plant Hire" },
  { key: "tools", label: "Tools" },
  { key: "concrete", label: "Concrete" },
  { key: "materials", label: "Materials" },
  { key: "subcontractors", label: "Subcontractors" },
  { key: "other", label: "Other" },
] as const;

type Category = typeof CATEGORIES[number]["key"];

const CATEGORY_ICONS: Record<Category, string> = {
  fuel: "droplet", diesel: "droplet", accommodation: "home",
  labour: "users", plant_hire: "truck", tools: "tool",
  concrete: "layers", materials: "package", subcontractors: "briefcase", other: "more-horizontal",
};

const CATEGORY_COLORS: Record<Category, string> = {
  fuel: "#E53935", diesel: "#D81B60", accommodation: "#8E24AA",
  labour: "#1E88E5", plant_hire: "#F4511E", tools: "#6D4C41",
  concrete: "#546E7A", materials: "#FF8F00", subcontractors: "#00897B", other: "#757575",
};

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: expenses, isLoading } = useListJobExpenses(jobId, {
    query: { queryKey: getListJobExpensesQueryKey(jobId) },
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "other" as Category,
    description: "",
    amount: "",
  });

  const createExpense = useCreateJobExpense({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobExpensesQueryKey(jobId) });
        setShowModal(false);
        setForm({ date: new Date().toISOString().split("T")[0], category: "other", description: "", amount: "" });
      },
      onError: () => Alert.alert("Error", "Failed to save expense"),
    },
  });

  const deleteExpense = useDeleteJobExpense({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListJobExpensesQueryKey(jobId) });
      },
      onError: () => Alert.alert("Error", "Failed to delete expense"),
    },
  });

  const handleSubmit = () => {
    if (!form.description.trim()) { Alert.alert("Validation", "Description is required"); return; }
    if (!form.amount || isNaN(Number(form.amount))) { Alert.alert("Validation", "Valid amount is required"); return; }
    createExpense.mutate({
      id: jobId,
      data: {
        date: form.date,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
      },
    });
  };

  const handleDelete = (expenseId: number, description: string) => {
    Alert.alert("Delete Expense", `Delete "${description}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense.mutate({ id: jobId, expenseId }) },
    ]);
  };

  const totalAmount = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);

  if (!isAdmin) {
    return (
      <View style={[styles.restricted, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={48} color={colors.mutedForeground} />
        <Text style={[styles.restrictedText, { color: colors.mutedForeground }]}>Expenses are only visible to administrators.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{expenses?.length ?? 0} expense{expenses?.length !== 1 ? "s" : ""}</Text>
          <Text style={[styles.summaryTotal, { color: colors.foreground }]}>
            Total: R {totalAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </Text>
        </View>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
          <Feather name="plus" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (expenses?.length ?? 0) === 0 ? (
        <View style={styles.center}>
          <Feather name="dollar-sign" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No expenses recorded yet</Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowModal(true)}>
            <Text style={styles.emptyBtnText}>Add First Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const cat = item.category as Category;
            const catColor = CATEGORY_COLORS[cat] ?? "#757575";
            const catIcon = CATEGORY_ICONS[cat] ?? "circle";
            const catLabel = CATEGORIES.find(c => c.key === cat)?.label ?? cat;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.catIcon, { backgroundColor: catColor + "20" }]}>
                  <Feather name={catIcon as any} size={18} color={catColor} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.catLabel, { color: catColor }]}>{catLabel}</Text>
                    <Text style={[styles.amount, { color: colors.foreground }]}>
                      R {item.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  <Text style={[styles.description, { color: colors.foreground }]}>{item.description}</Text>
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>
                    {new Date(item.date + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id, item.description)} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Add expense modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Expense</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
            {/* Date */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Date</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.date}
                onChangeText={v => setForm(f => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Category */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map(cat => {
                  const isSelected = form.category === cat.key;
                  const catColor = CATEGORY_COLORS[cat.key];
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: isSelected ? catColor : colors.muted,
                          borderColor: isSelected ? catColor : colors.border,
                        },
                      ]}
                      onPress={() => setForm(f => ({ ...f, category: cat.key }))}
                    >
                      <Text style={{ color: isSelected ? "#FFF" : colors.mutedForeground, fontSize: 12, fontFamily: "Inter_500Medium" }}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Description *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder="e.g. Diesel for excavator"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Amount */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Amount (R) *</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                value={form.amount}
                onChangeText={v => setForm(f => ({ ...f, amount: v }))}
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, createExpense.isPending && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={createExpense.isPending}
            >
              {createExpense.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.submitText}>Save Expense</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  summaryLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryTotal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  emptyBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: "#FFF", fontFamily: "Inter_600SemiBold" },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  catLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  amount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  description: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  date: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  deleteBtn: { padding: 8 },
  restricted: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  restrictedText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  fieldInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
