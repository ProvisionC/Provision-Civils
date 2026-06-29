import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, type KeyboardTypeOptions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import {
  useGetClient, useUpdateClient, useDeleteClient,
  getListClientsQueryKey, getGetClientQueryKey,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";

export default function EditClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: client, isLoading } = useGetClient(clientId, {
    query: { queryKey: getGetClientQueryKey(clientId) },
  });

  const [form, setForm] = useState({
    companyName: "", contactPerson: "", phone: "",
    email: "", address: "", vatNumber: "", notes: "",
  });

  useEffect(() => {
    if (client) {
      setForm({
        companyName: client.companyName ?? "",
        contactPerson: client.contactPerson ?? "",
        phone: client.phone ?? "",
        email: client.email ?? "",
        address: client.address ?? "",
        vatNumber: client.vatNumber ?? "",
        notes: client.notes ?? "",
      });
    }
  }, [client]);

  const updateClient = useUpdateClient({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to update client."),
    },
  });

  const deleteClient = useDeleteClient({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        router.back();
      },
    },
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      Alert.alert("Validation", "Company Name is required");
      return;
    }
    updateClient.mutate({
      id: clientId,
      data: {
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        vatNumber: form.vatNumber || undefined,
        notes: form.notes || undefined,
      },
    });
  };

  const handleDelete = () => {
    Alert.alert("Delete Client", `Delete ${client?.companyName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteClient.mutate({ id: clientId }) },
    ]);
  };

  if (isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 16, paddingBottom: 100, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Field label="Company Name *" value={form.companyName} onChangeText={v => update("companyName", v)} placeholder="e.g. ABC Civil Engineering" colors={colors} />
      <Field label="Contact Person" value={form.contactPerson} onChangeText={v => update("contactPerson", v)} placeholder="Full name" colors={colors} />
      <Field label="Phone Number" value={form.phone} onChangeText={v => update("phone", v)} placeholder="+27 xx xxx xxxx" keyboardType="phone-pad" colors={colors} />
      <Field label="Email Address" value={form.email} onChangeText={v => update("email", v)} placeholder="contact@company.co.za" keyboardType="email-address" colors={colors} />
      <Field label="Physical Address" value={form.address} onChangeText={v => update("address", v)} placeholder="123 Main St, Johannesburg, 2001" multiline colors={colors} />
      <Field label="VAT Number" value={form.vatNumber} onChangeText={v => update("vatNumber", v)} placeholder="4xxxxxxxxx" colors={colors} />
      <Field label="Notes" value={form.notes} onChangeText={v => update("notes", v)} placeholder="Any additional information..." multiline colors={colors} />

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, updateClient.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={updateClient.isPending}
        activeOpacity={0.85}
      >
        {updateClient.isPending ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Feather name="save" size={18} color="#FFF" />
            <Text style={styles.submitText}>Save Changes</Text>
          </>
        )}
      </TouchableOpacity>

      {isAdmin && (
        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.destructive }]}
          onPress={handleDelete}
          disabled={deleteClient.isPending}
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Delete Client</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

interface FieldProps {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: KeyboardTypeOptions;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}
function Field({ label, value, onChangeText, placeholder, multiline, keyboardType, colors }: FieldProps) {
  return (
    <View>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, multiline && styles.multiline]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground} multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1 },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
