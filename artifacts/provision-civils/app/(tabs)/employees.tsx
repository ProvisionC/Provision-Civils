import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, Platform, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useListEmployees, useDeleteEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { EmployeeCard } from "@/components/EmployeeCard";
import { useAuth } from "@/context/AuthContext";

export default function EmployeesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.role === "admin";

  const { data: employees, isLoading, refetch } = useListEmployees();
  const deleteEmployee = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
      },
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert("Delete Employee", `Remove ${name} from the system?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => deleteEmployee.mutate({ id }),
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Team</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/employee/create")}
            >
              <Feather name="plus" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {employees?.length ?? 0} member{employees?.length !== 1 ? "s" : ""}
        </Text>
      </View>

      <FlatList
        data={employees ?? []}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Platform.OS === "web" ? 120 : 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        scrollEnabled={!!(employees && employees.length > 0)}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isLoading ? "Loading..." : "No team members yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <EmployeeCard
            employee={item}
            onEdit={isAdmin ? () => router.push(`/employee/${item.id}` as any) : undefined}
            onDelete={isAdmin ? () => handleDelete(item.id, item.name) : undefined}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  list: { padding: 16 },
  empty: {
    alignItems: "center", gap: 12, paddingVertical: 60,
    borderWidth: 1, borderRadius: 12, margin: 16, borderStyle: "dashed",
  },
  emptyText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
