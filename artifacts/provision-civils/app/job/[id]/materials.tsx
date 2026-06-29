import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetJob, getGetJobQueryKey, getListJobsQueryKey, customFetch } from "@workspace/api-client-react";

const PREDEFINED = [
  "14mm Couplers",
  "8mm Couplers",
  "14/12 Reducers",
  "12mm Couplers",
  "Foam",
  "110mm Sleeve",
  "160mm Sleeve",
  "Metro Standard Manhole",
  "Metro Mini Manhole",
  "Rhino 400",
  "7-Way Blue",
  "7-Way Green",
  "12-Way Stripe",
  "12-Way Non-Stripe",
  "50mm Orange Duct",
];

interface MaterialItem {
  id?: number;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
  checked: boolean;
  isCustom: boolean;
}

function buildDefaultItems(existing: any[]): MaterialItem[] {
  const existingMap = new Map(existing.map(m => [m.name, m]));

  const predefined: MaterialItem[] = PREDEFINED.map(name => {
    const ex = existingMap.get(name);
    return {
      id: ex?.id,
      name,
      quantity: ex ? String(ex.quantity ?? 0) : "0",
      unit: "units",
      notes: ex?.notes ?? "",
      checked: ex?.checked ?? false,
      isCustom: false,
    };
  });

  const custom: MaterialItem[] = existing
    .filter(m => m.isCustom || !PREDEFINED.includes(m.name))
    .map(m => ({
      id: m.id,
      name: m.name,
      quantity: String(m.quantity ?? 0),
      unit: m.unit ?? "units",
      notes: m.notes ?? "",
      checked: m.checked ?? false,
      isCustom: true,
    }));

  return [...predefined, ...custom];
}

export default function MaterialsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: job, isLoading } = useGetJob(jobId, {
    query: { queryKey: getGetJobQueryKey(jobId) },
  });

  const [items, setItems] = useState<MaterialItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);

  useEffect(() => {
    if (job) {
      const existing = (job as any).materials ?? [];
      setItems(buildDefaultItems(existing));
    }
  }, [job]);

  const toggle = (name: string) => {
    Haptics.selectionAsync();
    setItems(prev => prev.map(item =>
      item.name === name ? { ...item, checked: !item.checked } : item
    ));
  };

  const setQty = (name: string, val: string) => {
    setItems(prev => prev.map(item =>
      item.name === name ? { ...item, quantity: val } : item
    ));
  };

  const setNotes = (name: string, val: string) => {
    setItems(prev => prev.map(item =>
      item.name === name ? { ...item, notes: val } : item
    ));
  };

  const toggleNotes = (name: string) => {
    setExpandedNotes(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const addCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (items.some(i => i.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate", "A material with that name already exists.");
      return;
    }
    setItems(prev => [...prev, {
      name: trimmed, quantity: "1", unit: "units",
      notes: "", checked: true, isCustom: true,
    }]);
    setCustomName("");
    setAddingCustom(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const removeCustom = (name: string) => {
    Alert.alert("Remove Material", `Remove "${name}" from the list?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setItems(prev => prev.filter(i => i.name !== name)) },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = items.map(m => ({
        name: m.name,
        quantity: Number(m.quantity) || 0,
        unit: m.unit,
        notes: m.notes || null,
        checked: m.checked,
        isCustom: m.isCustom,
        cost: null,
      }));

      await customFetch(`/api/jobs/${jobId}/materials`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
      qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
      Alert.alert("Saved", "Materials checklist saved successfully.");
    } catch {
      Alert.alert("Error", "Could not save materials. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const checkedCount = items.filter(i => i.checked).length;

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Summary bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.primary + "15", borderBottomColor: colors.primary + "30", borderBottomWidth: 1 }]}>
        <Feather name="package" size={16} color={colors.primary} />
        <Text style={[styles.summaryText, { color: colors.primary }]}>
          {checkedCount} of {items.length} materials used on this job
        </Text>
      </View>

      {/* Predefined items */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>STANDARD MATERIALS</Text>
      {items.filter(i => !i.isCustom).map(item => (
        <MaterialRow
          key={item.name}
          item={item}
          colors={colors}
          notesExpanded={expandedNotes.includes(item.name)}
          onToggle={() => toggle(item.name)}
          onQtyChange={v => setQty(item.name, v)}
          onNotesChange={v => setNotes(item.name, v)}
          onToggleNotes={() => toggleNotes(item.name)}
        />
      ))}

      {/* Custom items */}
      {items.filter(i => i.isCustom).length > 0 && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground, marginTop: 8 }]}>CUSTOM MATERIALS</Text>
          {items.filter(i => i.isCustom).map(item => (
            <MaterialRow
              key={item.name}
              item={item}
              colors={colors}
              notesExpanded={expandedNotes.includes(item.name)}
              onToggle={() => toggle(item.name)}
              onQtyChange={v => setQty(item.name, v)}
              onNotesChange={v => setNotes(item.name, v)}
              onToggleNotes={() => toggleNotes(item.name)}
              onRemove={() => removeCustom(item.name)}
            />
          ))}
        </>
      )}

      {/* Add custom */}
      <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {addingCustom ? (
          <View style={styles.addRow}>
            <TextInput
              style={[styles.addInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              placeholder="Material name..."
              placeholderTextColor={colors.mutedForeground}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={addCustom}
            />
            <TouchableOpacity style={[styles.addConfirm, { backgroundColor: colors.primary }]} onPress={addCustom}>
              <Feather name="check" size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addCancel, { backgroundColor: colors.muted }]} onPress={() => { setAddingCustom(false); setCustomName(""); }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addTrigger} onPress={() => setAddingCustom(true)}>
            <Feather name="plus-circle" size={18} color={colors.primary} />
            <Text style={[styles.addTriggerText, { color: colors.primary }]}>Add Custom Material</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Feather name="save" size={18} color="#FFF" />
            <Text style={styles.saveBtnText}>Save Materials Checklist</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

interface RowProps {
  item: MaterialItem;
  colors: any;
  notesExpanded: boolean;
  onToggle: () => void;
  onQtyChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onToggleNotes: () => void;
  onRemove?: () => void;
}

function MaterialRow({ item, colors, notesExpanded, onToggle, onQtyChange, onNotesChange, onToggleNotes, onRemove }: RowProps) {
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: item.checked ? colors.primary + "40" : colors.border }]}>
      <TouchableOpacity onPress={onToggle} style={styles.checkbox} activeOpacity={0.7}>
        <View style={[
          styles.checkBox,
          { borderColor: item.checked ? colors.primary : colors.mutedForeground },
          item.checked && { backgroundColor: colors.primary },
        ]}>
          {item.checked && <Feather name="check" size={12} color="#FFF" />}
        </View>
      </TouchableOpacity>

      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.matName, { color: item.checked ? colors.foreground : colors.mutedForeground }]}>
            {item.name}
          </Text>
          <View style={styles.rowActions}>
            {item.checked && (
              <>
                <TouchableOpacity onPress={onToggleNotes} style={[styles.notesBtn, { backgroundColor: notesExpanded ? colors.primary + "20" : colors.muted }]}>
                  <Feather name="message-square" size={13} color={notesExpanded ? colors.primary : colors.mutedForeground} />
                </TouchableOpacity>
                {onRemove && (
                  <TouchableOpacity onPress={onRemove} style={[styles.removeBtn, { backgroundColor: colors.muted }]}>
                    <Feather name="trash-2" size={13} color={colors.destructive} />
                  </TouchableOpacity>
                )}
              </>
            )}
            {!item.checked && onRemove && (
              <TouchableOpacity onPress={onRemove} style={[styles.removeBtn, { backgroundColor: colors.muted }]}>
                <Feather name="trash-2" size={13} color={colors.destructive} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {item.checked && (
          <View style={styles.qtyRow}>
            <Feather name="package" size={12} color={colors.mutedForeground} />
            <Text style={[styles.qtyLabel, { color: colors.mutedForeground }]}>Qty:</Text>
            <TextInput
              style={[styles.qtyInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
              value={item.quantity}
              onChangeText={onQtyChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[styles.unitLabel, { color: colors.mutedForeground }]}>{item.unit}</Text>
          </View>
        )}

        {item.checked && notesExpanded && (
          <TextInput
            style={[styles.notesInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
            value={item.notes}
            onChangeText={onNotesChange}
            placeholder="Add notes..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={2}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summaryBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  summaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionHeader: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  row: {
    flexDirection: "row", alignItems: "flex-start",
    marginHorizontal: 12, marginBottom: 6, borderRadius: 12, borderWidth: 1,
    padding: 12, gap: 10,
  },
  checkbox: { paddingTop: 2 },
  checkBox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  rowContent: { flex: 1, gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  matName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  rowActions: { flexDirection: "row", gap: 6 },
  notesBtn: { borderRadius: 6, padding: 5 },
  removeBtn: { borderRadius: 6, padding: 5 },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  qtyLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  qtyInput: {
    width: 60, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8,
    paddingVertical: Platform.OS === "ios" ? 6 : 4, fontSize: 14, fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  unitLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notesInput: {
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, fontFamily: "Inter_400Regular", textAlignVertical: "top", minHeight: 56,
  },
  addCard: {
    marginHorizontal: 12, marginTop: 12, marginBottom: 8,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  addInput: {
    flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8, fontSize: 14, fontFamily: "Inter_400Regular",
  },
  addConfirm: { borderRadius: 8, padding: 10 },
  addCancel: { borderRadius: 8, padding: 10 },
  addTrigger: { flexDirection: "row", alignItems: "center", gap: 10 },
  addTriggerText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    marginHorizontal: 12, marginTop: 8, borderRadius: 14, paddingVertical: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  saveBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
