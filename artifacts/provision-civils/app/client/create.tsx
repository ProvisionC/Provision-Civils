import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, type KeyboardTypeOptions,
} from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useCreateClient, getListClientsQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

export default function CreateClientScreen() {
  const colors = useColors();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    companyName: "", contactPerson: "", phone: "",
    email: "", address: "", vatNumber: "", notes: "",
  });

  const createClient = useCreateClient({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
        router.back();
      },
      onError: () => Alert.alert("Error", "Failed to create client. Please try again."),
    },
  });

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.companyName.trim()) {
      Alert.alert("Validation", "Company Name is required");
      return;
    }
    createClient.mutate({
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
        style={[styles.submitBtn, { backgroundColor: colors.primary }, createClient.isPending && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={createClient.isPending}
        activeOpacity={0.85}
      >
        {createClient.isPending ? (
          <ActivityIndicator color="#FFF" size="small" />
        ) : (
          <>
            <Feather name="user-plus" size={18} color="#FFF" />
            <Text style={styles.submitText}>Save Client</Text>
          </>
        )}
      </TouchableOpacity>
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
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  submitBtn: { borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  submitText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
