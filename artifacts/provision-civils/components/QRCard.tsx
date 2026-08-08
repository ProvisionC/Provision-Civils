import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export interface QRCardProps {
  name: string;
  clockNumber: string;
  photoUrl?: string;
}

export function QRCard({ name, clockNumber, photoUrl }: QRCardProps) {
  const colors = useColors();
  
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Feather name="hard-drive" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.companyName, { color: colors.foreground }]}>Provision Civils</Text>
      </View>
      
      <View style={styles.content}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, { backgroundColor: colors.muted, justifyContent: 'center', alignItems: 'center' }]}>
            <Feather name="user" size={40} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.qrContainer}>
          <QRCode value={clockNumber} size={100} color={colors.foreground} backgroundColor={colors.card} />
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.clockNumber, { color: colors.mutedForeground }]}>Clock #: {clockNumber}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 250, height: 420, borderRadius: 12, padding: 20,
    borderWidth: 1, alignItems: "center", justifyContent: "space-between",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  companyName: { fontSize: 16, fontWeight: "bold" },
  content: { alignItems: "center", gap: 10 },
  photo: { width: 80, height: 80, borderRadius: 40, marginBottom: 10 },
  qrContainer: { padding: 10, backgroundColor: "#fff", borderRadius: 8 },
  name: { fontSize: 18, fontWeight: "bold" },
  clockNumber: { fontSize: 14 },
});
