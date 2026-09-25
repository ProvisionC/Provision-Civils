import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";
import { getListLabourEntriesQueryKey, useListLabourEntries } from "@workspace/api-client-react";

export default function WorkScreen() {
  const colors = useColors();
  const { data: entries, isLoading } = useListLabourEntries({}, {
    query: { queryKey: getListLabourEntriesQueryKey({}), retry: false },
  });
  const currentEntries = entries ?? [];
  const summary = currentEntries.reduce((total, entry) => ({
    totalHours: total.totalHours + Number(entry.hoursWorked ?? 0),
    totalMeters: total.totalMeters + Number(entry.metersCompleted ?? 0),
    totalEarnings: total.totalEarnings + Number(entry.amountPayable ?? 0),
  }), { totalHours: 0, totalMeters: 0, totalEarnings: 0 });

  if (isLoading && currentEntries.length === 0) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>My Work</Text>
      
      <ScrollView>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stat}><Text style={styles.statLabel}>Hours</Text><Text style={styles.statVal}>{summary.totalHours.toFixed(2)}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>Meters</Text><Text style={styles.statVal}>{summary.totalMeters.toFixed(1)}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>Total</Text><Text style={[styles.statVal, { color: colors.primary }]}>R {summary.totalEarnings.toFixed(2)}</Text></View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Month</Text>
          {currentEntries.map(entry => (
            <View key={entry.id} style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground }}>{entry.date}</Text>
              <Text style={{ color: colors.mutedForeground }}>{entry.hoursWorked ?? "0"} hrs | {entry.metersCompleted ?? "0"} m | R{entry.amountPayable ?? "0"}</Text>
            </View>
          ))}
          {currentEntries.length === 0 && <View style={styles.empty}><Text style={{ color: colors.mutedForeground }}>No attendance entries this month.</Text></View>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  tabBar: { flexDirection: "row", marginBottom: 20 },
  tab: { flex: 1, padding: 10, alignItems: "center", borderBottomWidth: 2, borderColor: "#ccc" },
  activeTab: { borderColor: "#000" },
  tabText: { fontWeight: "bold" },
  summaryCard: { flexDirection: "row", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  stat: { flex: 1, alignItems: "center" },
  statLabel: { fontSize: 12, color: "#666" },
  statVal: { fontSize: 16, fontWeight: "bold" },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  entryCard: { padding: 16, borderRadius: 8, borderWidth: 1, marginBottom: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
});
