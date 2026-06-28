import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useListInvoices } from "@workspace/api-client-react";
import { InvoiceCard } from "@/components/InvoiceCard";

export default function InvoicesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: invoices, isLoading, refetch } = useListInvoices();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalRevenue = invoices?.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Invoices</Text>
        <View style={[styles.revenueCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Text style={[styles.revenueLabel, { color: colors.mutedForeground }]}>Total Revenue (Paid)</Text>
          <Text style={[styles.revenueValue, { color: colors.primary }]}>R{totalRevenue.toFixed(2)}</Text>
        </View>
      </View>

      <FlatList
        data={invoices ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        scrollEnabled={!!(invoices && invoices.length > 0)}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="file-text" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No invoices yet"}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Generate invoices from job details
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <InvoiceCard invoice={item} onPress={() => router.push(`/invoice/${item.id}` as any)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, gap: 14 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  revenueCard: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 4 },
  revenueLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  revenueValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  list: { padding: 16 },
  empty: {
    alignItems: "center", gap: 8, paddingVertical: 60,
    borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
