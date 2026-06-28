import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Share, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import {
  useGetInvoice, useUpdateInvoice,
  getGetInvoiceQueryKey, getListInvoicesQueryKey,
} from "@workspace/api-client-react";

const STATUSES = ["draft", "sent", "paid", "overdue"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue",
};

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invId = Number(id);
  const colors = useColors();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useGetInvoice(invId, {
    query: { queryKey: getGetInvoiceQueryKey(invId) },
  });

  const updateInvoice = useUpdateInvoice({
    mutation: {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getGetInvoiceQueryKey(invId) });
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      },
    },
  });

  const handleStatusChange = (status: string) => {
    updateInvoice.mutate({ id: invId, data: { status } as any });
  };

  const handleShare = async () => {
    if (!invoice) return;
    const job = invoice.job as any;
    const content = `
INVOICE: ${invoice.invoiceNumber}
Date: ${new Date(invoice.createdAt).toLocaleDateString()}

PROVISION CIVILS
Construction Management

CLIENT: ${job?.clientName ?? "N/A"}
JOB: ${job?.jobNumber ?? "N/A"}
Site: ${job?.siteAddress ?? "N/A"}

BREAKDOWN:
Labour:    R${invoice.labourCost.toFixed(2)}
Materials: R${invoice.materialsCost.toFixed(2)}
Equipment: R${invoice.equipmentCost.toFixed(2)}
           --------
Subtotal:  R${(invoice.labourCost + invoice.materialsCost + invoice.equipmentCost).toFixed(2)}
VAT (${invoice.vat}%): R${((invoice.labourCost + invoice.materialsCost + invoice.equipmentCost) * (invoice.vat / 100)).toFixed(2)}
           ========
TOTAL:     R${invoice.total.toFixed(2)}

Status: ${STATUS_LABELS[invoice.status] ?? invoice.status}
${invoice.notes ? `\nNotes: ${invoice.notes}` : ""}
    `.trim();

    await Share.share({ message: content, title: `Invoice ${invoice.invoiceNumber}` });
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Invoice not found</Text>
      </View>
    );
  }

  const job = invoice.job as any;
  const subtotal = invoice.labourCost + invoice.materialsCost + invoice.equipmentCost;
  const vatAmount = subtotal * (invoice.vat / 100);

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.invoiceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.invoiceHeader}>
          <View>
            <Text style={[styles.invoiceTitle, { color: colors.primary }]}>INVOICE</Text>
            <Text style={[styles.invoiceNumber, { color: colors.foreground }]}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status).bg }]}>
            <Text style={[styles.statusText, { color: getStatusColor(invoice.status).text }]}>
              {STATUS_LABELS[invoice.status]}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>FROM</Text>
          <Text style={[styles.companyName, { color: colors.foreground }]}>PROVISION CIVILS</Text>
          <Text style={[styles.companyDetail, { color: colors.mutedForeground }]}>Construction Management</Text>
        </View>

        {job && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CLIENT</Text>
            <Text style={[styles.clientName, { color: colors.foreground }]}>{job.clientName}</Text>
            {job.siteAddress && <Text style={[styles.clientDetail, { color: colors.mutedForeground }]}>{job.siteAddress}</Text>}
            {job.clientEmail && <Text style={[styles.clientDetail, { color: colors.mutedForeground }]}>{job.clientEmail}</Text>}
            <Text style={[styles.jobRef, { color: colors.primary }]}>Job Ref: {job.jobNumber}</Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>DATE</Text>
          <Text style={[styles.detailValue, { color: colors.foreground }]}>
            {new Date(invoice.createdAt).toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.breakdown}>
          <Text style={[styles.breakdownTitle, { color: colors.foreground }]}>Breakdown</Text>
          <LineItem label="Labour" amount={invoice.labourCost} colors={colors} />
          <LineItem label="Materials" amount={invoice.materialsCost} colors={colors} />
          <LineItem label="Equipment" amount={invoice.equipmentCost} colors={colors} />
          <View style={[styles.subtotalLine, { borderTopColor: colors.border }]}>
            <Text style={[styles.subtotalLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.subtotalValue, { color: colors.foreground }]}>R{subtotal.toFixed(2)}</Text>
          </View>
          <LineItem label={`VAT (${invoice.vat}%)`} amount={vatAmount} colors={colors} muted />
          <View style={[styles.totalLine, { backgroundColor: colors.primary + "10", borderRadius: 10 }]}>
            <Text style={[styles.totalLabel, { color: colors.primary }]}>TOTAL</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>R{invoice.total.toFixed(2)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NOTES</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>{invoice.notes}</Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Update Status</Text>
        <View style={styles.statusChips}>
          {STATUSES.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, {
                backgroundColor: invoice.status === s ? colors.primary : colors.muted,
                borderColor: invoice.status === s ? colors.primary : colors.border,
              }]}
              onPress={() => handleStatusChange(s)}
              disabled={invoice.status === s || updateInvoice.isPending}
            >
              <Text style={{ color: invoice.status === s ? "#FFF" : colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                {STATUS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
        <Feather name="share-2" size={18} color="#FFF" />
        <Text style={styles.shareBtnText}>Share Invoice</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function LineItem({ label, amount, colors, muted }: { label: string; amount: number; colors: any; muted?: boolean }) {
  return (
    <View style={styles.lineItem}>
      <Text style={[styles.lineLabel, { color: muted ? colors.mutedForeground : colors.foreground }]}>{label}</Text>
      <Text style={[styles.lineAmount, { color: muted ? colors.mutedForeground : colors.foreground }]}>R{amount.toFixed(2)}</Text>
    </View>
  );
}

function getStatusColor(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    draft: { bg: "#EEF1F8", text: "#64748B" },
    sent: { bg: "#E3F2FD", text: "#1565C0" },
    paid: { bg: "#E8F5E9", text: "#2E7D32" },
    overdue: { bg: "#FFEBEE", text: "#C62828" },
  };
  return map[status] ?? map.draft;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  invoiceCard: { margin: 16, borderRadius: 16, padding: 20, borderWidth: 1, gap: 16 },
  invoiceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  invoiceTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", letterSpacing: 2 },
  invoiceNumber: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1 },
  section: { gap: 4 },
  sectionLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2 },
  companyName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  companyDetail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  clientName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  clientDetail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  jobRef: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  detailValue: { fontSize: 14, fontFamily: "Inter_400Regular" },
  breakdown: { gap: 10 },
  breakdownTitle: { fontSize: 14, fontFamily: "Inter_700Bold", marginBottom: 4 },
  lineItem: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  lineLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  lineAmount: { fontSize: 14, fontFamily: "Inter_500Medium" },
  subtotalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, marginTop: 4 },
  subtotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  subtotalValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  totalLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 14, marginTop: 4 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  card: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  shareBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
