import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

// Mock API Call - replace with real API hook later
async function fetchWorkerPayroll() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        summary: { totalHours: 160, totalMeters: 500, totalEarnings: 15000 },
        entries: [
          { id: 1, date: "2025-08-01", jobName: "Site A", hoursWorked: 8, metersCompleted: 50, amountPayable: 1250 },
          { id: 2, date: "2025-08-02", jobName: "Site B", hoursWorked: 8, metersCompleted: 45, amountPayable: 1125 },
        ]
      });
    }, 1000);
  });
}

import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";

// ... (fetchWorkerPayroll mock)

export default function WorkScreen() {
  const colors = useColors();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timesheets" | "payslips">("timesheets");

  useEffect(() => {
    fetchWorkerPayroll().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>My Work</Text>
      
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === "timesheets" && styles.activeTab]} onPress={() => setActiveTab("timesheets")}>
          <Text style={styles.tabText}>Timesheets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "payslips" && styles.activeTab]} onPress={() => setActiveTab("payslips")}>
          <Text style={styles.tabText}>Payslips</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "timesheets" ? (
        <ScrollView>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.stat}><Text style={styles.statLabel}>Hours</Text><Text style={styles.statVal}>{data.summary.totalHours}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>Meters</Text><Text style={styles.statVal}>{data.summary.totalMeters}</Text></View>
            <View style={styles.stat}><Text style={styles.statLabel}>Total</Text><Text style={[styles.statVal, { color: colors.primary }]}>R {data.summary.totalEarnings}</Text></View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Entries</Text>
          {data.entries.map((entry: any) => (
            <View key={entry.id} style={[styles.entryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground }}>{entry.date} - {entry.jobName}</Text>
              <Text style={{ color: colors.mutedForeground }}>{entry.hoursWorked} hrs | {entry.metersCompleted} m | R{entry.amountPayable}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}><Text style={{ color: colors.mutedForeground }}>No payslips found.</Text></View>
      )}
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
