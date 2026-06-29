import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function UpdateBanner({ visible, onApply, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <View style={styles.banner}>
      <View style={styles.iconWrap}>
        <Feather name="download-cloud" size={18} color="#FFF" />
      </View>
      <Text style={styles.text} numberOfLines={2}>
        Update downloaded — restart to apply.
      </Text>
      <TouchableOpacity style={styles.applyBtn} onPress={onApply} activeOpacity={0.85}>
        <Text style={styles.applyText}>Restart</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="x" size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#1565C0",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  text:     { flex: 1, color: "#FFF", fontFamily: "Inter_500Medium", fontSize: 13 },
  applyBtn: {
    backgroundColor: "#FF6F00", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  applyText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 13 },
});
