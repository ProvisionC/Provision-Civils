import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Invoice } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#EEF1F8", text: "#64748B" },
  sent: { bg: "#E3F2FD", text: "#1565C0" },
  paid: { bg: "#E8F5E9", text: "#2E7D32" },
  overdue: { bg: "#FFEBEE", text: "#C62828" },
};

interface InvoiceCardProps {
  invoice: Invoice;
  onPress?: () => void;
}

export function InvoiceCard({ invoice, onPress }: InvoiceCardProps) {
  const colors = useColors();
  const status = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.draft;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.number, { color: colors.primary }]}>{invoice.invoiceNumber}</Text>
          <Text style={[styles.job, { color: colors.mutedForeground }]}>
            {(invoice.job as any)?.jobNumber ?? `Job #${invoice.jobId}`}
          </Text>
        </View>
        <View>
          <View style={[styles.status, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.total, { color: colors.foreground }]}>
          R{invoice.total.toFixed(2)}
        </Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {new Date(invoice.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  number: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  job: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  status: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  total: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
