import React from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useGetJobCosting, getGetJobCostingQueryKey } from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const EXPENSE_LABELS: Record<string, string> = {
  fuel: "Fuel", diesel: "Diesel", accommodation: "Accommodation",
  labour: "Labour (Expenses)", plant_hire: "Plant Hire", tools: "Tools",
  concrete: "Concrete", materials: "Materials", subcontractors: "Subcontractors", other: "Other",
};

const EXPENSE_COLORS: Record<string, string> = {
  fuel: "#F97316", diesel: "#EA580C", accommodation: "#8B5CF6",
  labour: "#2563EB", plant_hire: "#D97706", tools: "#64748B",
  concrete: "#71717A", materials: "#0EA5E9", subcontractors: "#EC4899", other: "#6B7280",
};

export default function JobCostingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Number(id);
  const colors = useColors();
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={40} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, marginTop: 12, fontFamily: "Inter_400Regular" }}>Admin only</Text>
      </View>
    );
  }

  const { data, isLoading } = useGetJobCosting(jobId, {
    query: { queryKey: getGetJobCostingQueryKey(jobId) },
  });

  const s = makeStyles(colors);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>No costing data</Text>
      </View>
    );
  }

  const isProfitable = data.profitLoss >= 0;
  const expenseCategories = Object.entries(data.expensesByCategory ?? {}).filter(([, v]) => Number(v) > 0);

  return (
    <ScrollView style={[s.container]} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      {/* Profit / Loss hero */}
      <View style={[s.heroCard, { backgroundColor: isProfitable ? "#22C55E18" : "#EF444415", borderColor: isProfitable ? "#22C55E40" : "#EF444440" }]}>
        <View style={s.heroRow}>
          <View>
            <Text style={[s.heroLabel, { color: isProfitable ? "#22C55E" : "#EF4444" }]}>
              {isProfitable ? "Profit" : "Loss"}
            </Text>
            <Text style={[s.heroValue, { color: isProfitable ? "#22C55E" : "#EF4444" }]}>
              R {Math.abs(data.profitLoss).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={[s.plIcon, { backgroundColor: isProfitable ? "#22C55E" : "#EF4444" }]}>
            <Feather name={isProfitable ? "trending-up" : "trending-down"} size={24} color="#FFF" />
          </View>
        </View>

        <View style={[s.heroDivider, { backgroundColor: isProfitable ? "#22C55E40" : "#EF444440" }]} />

        <View style={s.heroMeta}>
          <View style={s.heroMetaItem}>
            <Text style={[s.heroMetaLabel, { color: colors.mutedForeground }]}>Revenue</Text>
            <Text style={[s.heroMetaValue, { color: colors.foreground }]}>R {data.revenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={s.heroMetaItem}>
            <Text style={[s.heroMetaLabel, { color: colors.mutedForeground }]}>Total Cost</Text>
            <Text style={[s.heroMetaValue, { color: colors.foreground }]}>R {data.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</Text>
          </View>
          <View style={s.heroMetaItem}>
            <Text style={[s.heroMetaLabel, { color: colors.mutedForeground }]}>Margin</Text>
            <Text style={[s.heroMetaValue, { color: isProfitable ? "#22C55E" : "#EF4444" }]}>
              {data.revenue > 0 ? `${((data.profitLoss / data.revenue) * 100).toFixed(1)}%` : "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* Cost breakdown */}
      <Text style={[s.sectionTitle, { color: colors.foreground }]}>Cost Breakdown</Text>

      {/* Labour cost */}
      <CostRow
        icon="users"
        label="Labour Cost"
        amount={data.labourCost}
        color={colors.primary}
        colors={colors}
        total={data.totalCost}
        s={s}
      />

      {/* Materials */}
      {(data.materialsCost ?? 0) > 0 && (
        <CostRow
          icon="package"
          label="Materials"
          amount={data.materialsCost ?? 0}
          color="#0EA5E9"
          colors={colors}
          total={data.totalCost}
          s={s}
        />
      )}

      {/* Expenses by category */}
      {expenseCategories.map(([cat, amt]) => (
        <CostRow
          key={cat}
          icon={catIcon(cat)}
          label={EXPENSE_LABELS[cat] ?? cat}
          amount={Number(amt)}
          color={EXPENSE_COLORS[cat] ?? "#6B7280"}
          colors={colors}
          total={data.totalCost}
          s={s}
        />
      ))}

      {expenseCategories.length === 0 && data.materialsCost === 0 && data.labourCost === 0 && (
        <View style={[s.empty, { borderColor: colors.border }]}>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No costs recorded yet</Text>
        </View>
      )}

      {/* Totals */}
      <View style={[s.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: colors.mutedForeground }]}>Total Labour</Text>
          <Text style={[s.totalVal, { color: colors.primary }]}>R {data.labourCost.toFixed(2)}</Text>
        </View>
        {(data.materialsCost ?? 0) > 0 && (
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, { color: colors.mutedForeground }]}>Materials</Text>
            <Text style={[s.totalVal, { color: "#0EA5E9" }]}>R {(data.materialsCost ?? 0).toFixed(2)}</Text>
          </View>
        )}
        {expenseCategories.map(([cat, amt]) => (
          <View key={cat} style={s.totalRow}>
            <Text style={[s.totalLabel, { color: colors.mutedForeground }]}>{EXPENSE_LABELS[cat] ?? cat}</Text>
            <Text style={[s.totalVal, { color: EXPENSE_COLORS[cat] ?? colors.foreground }]}>R {Number(amt).toFixed(2)}</Text>
          </View>
        ))}
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Total Cost</Text>
          <Text style={[s.totalVal, { color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 16 }]}>R {data.totalCost.toFixed(2)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: colors.mutedForeground }]}>Contract Value (Revenue)</Text>
          <Text style={[s.totalVal, { color: colors.foreground }]}>R {data.revenue.toFixed(2)}</Text>
        </View>
        <View style={[s.divider, { backgroundColor: colors.border }]} />
        <View style={s.totalRow}>
          <Text style={[s.totalLabel, { color: isProfitable ? "#22C55E" : "#EF4444", fontFamily: "Inter_700Bold" }]}>
            {isProfitable ? "Profit" : "Loss"}
          </Text>
          <Text style={[s.totalVal, { color: isProfitable ? "#22C55E" : "#EF4444", fontFamily: "Inter_700Bold", fontSize: 16 }]}>
            R {Math.abs(data.profitLoss).toFixed(2)}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function CostRow({ icon, label, amount, color, colors, total, s }: {
  icon: any; label: string; amount: number; color: string; colors: any; total: number; s: any;
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <View style={[s.costRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[s.costIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.costMeta}>
          <Text style={[s.costLabel, { color: colors.foreground }]}>{label}</Text>
          <Text style={[s.costAmount, { color }]}>R {amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</Text>
        </View>
        <View style={[s.barBg, { backgroundColor: colors.muted }]}>
          <View style={[s.barFill, { width: `${Math.min(100, pct)}%`, backgroundColor: color }]} />
        </View>
        <Text style={[s.pctText, { color: colors.mutedForeground }]}>{pct.toFixed(1)}% of total cost</Text>
      </View>
    </View>
  );
}

function catIcon(cat: string): any {
  const map: Record<string, string> = {
    fuel: "droplet", diesel: "droplet", accommodation: "home",
    labour: "users", plant_hire: "truck", tools: "tool",
    concrete: "box", materials: "package", subcontractors: "briefcase", other: "more-horizontal",
  };
  return map[cat] ?? "dollar-sign";
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    heroCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 20 },
    heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    heroLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, marginBottom: 4 },
    heroValue: { fontFamily: "Inter_700Bold", fontSize: 32 },
    plIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
    heroDivider: { height: 1, marginVertical: 14 },
    heroMeta: { flexDirection: "row", justifyContent: "space-between" },
    heroMetaItem: { alignItems: "center", flex: 1 },
    heroMetaLabel: { fontFamily: "Inter_400Regular", fontSize: 11, marginBottom: 3 },
    heroMetaValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
    sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, marginBottom: 12 },
    costRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
    costIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    costMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    costLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    costAmount: { fontFamily: "Inter_700Bold", fontSize: 14 },
    barBg: { height: 6, borderRadius: 3, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 3 },
    pctText: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4 },
    totalCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 20 },
    totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
    totalLabel: { fontFamily: "Inter_400Regular", fontSize: 14 },
    totalVal: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
    divider: { height: 1, marginVertical: 8 },
    empty: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: "center", marginTop: 4 },
    emptyText: { fontFamily: "Inter_400Regular", fontSize: 14 },
  });
}
