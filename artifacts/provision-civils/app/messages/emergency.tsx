import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSendEmergencyBroadcast } from "@workspace/api-client-react";

const PRESETS = [
  { label: "Evacuate immediately", content: "All personnel must evacuate the site immediately. Proceed to the emergency assembly point." },
  { label: "Work suspended", content: "All work on site has been suspended until further notice. Please await instructions from your supervisor." },
  { label: "Medical emergency", content: "There is a medical emergency on site. Please clear the area and await first responder instructions." },
  { label: "Severe weather", content: "Severe weather conditions are approaching. Secure all equipment and tools and take shelter immediately." },
];

export default function EmergencyBroadcastScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [title, setTitle] = useState("🚨 Emergency Alert");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const broadcast = useSendEmergencyBroadcast();

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert("Error", "Title and message are required");
      return;
    }
    Alert.alert(
      "Send Emergency Broadcast",
      "This will send a push notification to ALL users immediately. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Now", style: "destructive", onPress: async () => {
            try {
              const result = await broadcast.mutateAsync({ data: { title: title.trim(), message: message.trim() } });
              setSentCount((result as any).sent ?? 0);
              setSent(true);
            } catch (e: any) {
              Alert.alert("Error", e.message ?? "Failed to send broadcast");
            }
          },
        },
      ],
    );
  };

  if (sent) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Emergency Broadcast</Text>
        </View>
        <View style={styles.successCenter}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={60} color="#22C55E" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Broadcast Sent!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            Notified {sentCount} user{sentCount !== 1 ? "s" : ""}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>🚨 Emergency Broadcast</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.warningBox, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
          <Feather name="alert-triangle" size={18} color="#EF4444" />
          <Text style={styles.warningText}>This sends an immediate push notification to <Text style={{ fontFamily: "Inter_700Bold" }}>all users</Text> on the platform.</Text>
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Alert Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Emergency title"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="What do personnel need to know and do?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={4}
          style={[styles.textarea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Quick Templates</Text>
        {PRESETS.map(p => (
          <TouchableOpacity
            key={p.label}
            onPress={() => setMessage(p.content)}
            style={[styles.presetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="zap" size={14} color="#F59E0B" />
            <Text style={[styles.presetText, { color: colors.foreground }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          onPress={handleSend}
          disabled={broadcast.isPending}
          style={[styles.sendBtn, { backgroundColor: "#EF4444" }]}
        >
          {broadcast.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Feather name="alert-triangle" size={18} color="#FFF" />
              <Text style={styles.sendBtnText}>Send Emergency Broadcast</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 10 },
  back: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 12 },
  warningBox: { borderWidth: 1, borderRadius: 12, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  warningText: { flex: 1, color: "#991B1B", fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  textarea: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, textAlignVertical: "top" },
  presetBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  presetText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
  sendBtn: { borderRadius: 12, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  sendBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  successCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  successIcon: {},
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  successSub: { fontSize: 15, fontFamily: "Inter_400Regular" },
  doneBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneBtnText: { color: "#FFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
