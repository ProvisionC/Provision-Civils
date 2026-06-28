import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Employee } from "@workspace/api-client-react";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "#E8EDF5", text: "#1565C0" },
  supervisor: { bg: "#FFF3E0", text: "#E65100" },
  worker: { bg: "#E8F5E9", text: "#2E7D32" },
};

interface EmployeeCardProps {
  employee: Employee;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function EmployeeCard({ employee, onEdit, onDelete }: EmployeeCardProps) {
  const colors = useColors();
  const roleStyle = ROLE_COLORS[employee.role] ?? ROLE_COLORS.worker;
  const initials = employee.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
        <Text style={[styles.initials, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]}>{employee.name}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>{employee.email}</Text>
        {employee.phone ? (
          <Text style={[styles.phone, { color: colors.mutedForeground }]}>{employee.phone}</Text>
        ) : null}
        <View style={[styles.roleBadge, { backgroundColor: roleStyle.bg }]}>
          <Text style={[styles.roleText, { color: roleStyle.text }]}>
            {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity style={styles.actionBtn} onPress={onEdit}>
            <Feather name="edit-2" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity style={styles.actionBtn} onPress={onDelete}>
            <Feather name="trash-2" size={16} color={colors.destructive} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  email: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  phone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  roleBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
});
