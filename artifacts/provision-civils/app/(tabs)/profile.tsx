import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const colors = useColors();
  const { user } = useAuth();
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>My Profile</Text>
      <Text style={{ color: colors.foreground }}>Name: {user?.name}</Text>
      <Text style={{ color: colors.foreground }}>Email: {user?.email}</Text>
      <Text style={{ color: colors.foreground }}>Role: {user?.role}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold" },
});
