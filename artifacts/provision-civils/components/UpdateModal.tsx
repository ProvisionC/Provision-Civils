import React from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Linking, ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { ServerVersion } from "@/hooks/useAppUpdate";

interface Props {
  visible: boolean;
  serverVersion: ServerVersion | undefined;
  localVersion: string;
}

export function UpdateModal({ visible, serverVersion, localVersion }: Props) {
  const colors = useColors();

  const handleDownload = () => {
    const url = serverVersion?.downloadUrl;
    if (url) Linking.openURL(url);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: "#1565C015" }]}>
            <Feather name="download-cloud" size={40} color="#1565C0" />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>Update Required</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your app is out of date and must be updated to continue.
          </Text>

          {/* Version comparison */}
          <View style={[styles.versionBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.mutedForeground }]}>Your version</Text>
              <View style={[styles.badge, { backgroundColor: "#EF444420" }]}>
                <Text style={[styles.badgeText, { color: "#EF4444" }]}>v{localVersion}</Text>
              </View>
            </View>
            <View style={[styles.versionDivider, { backgroundColor: colors.border }]} />
            <View style={styles.versionRow}>
              <Text style={[styles.versionLabel, { color: colors.mutedForeground }]}>Latest version</Text>
              <View style={[styles.badge, { backgroundColor: "#22C55E20" }]}>
                <Text style={[styles.badgeText, { color: "#22C55E" }]}>v{serverVersion?.version ?? "—"}</Text>
              </View>
            </View>
          </View>

          {/* Release notes */}
          {serverVersion?.releaseNotes ? (
            <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>What's new</Text>
              <Text style={[styles.notesText, { color: colors.foreground }]}>
                {serverVersion.releaseNotes}
              </Text>
            </ScrollView>
          ) : null}

          {/* CTA */}
          {serverVersion?.downloadUrl ? (
            <TouchableOpacity
              style={styles.downloadBtn}
              onPress={handleDownload}
              activeOpacity={0.85}
            >
              <Feather name="download" size={18} color="#FFF" />
              <Text style={styles.downloadBtnText}>Download Update</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.contactBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={16} color={colors.mutedForeground} />
              <Text style={[styles.contactText, { color: colors.mutedForeground }]}>
                Contact your administrator to receive the latest version of the app.
              </Text>
            </View>
          )}

          <Text style={[styles.footNote, { color: colors.mutedForeground }]}>
            Your data is safe — updating will not affect jobs, payroll, or reports.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 400, borderRadius: 20, borderWidth: 1,
    padding: 24, alignItems: "center", gap: 14,
  },
  iconWrap: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  title:    { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 20 },

  versionBox: {
    width: "100%", borderRadius: 12, borderWidth: 1, overflow: "hidden",
  },
  versionRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 11,
  },
  versionLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  versionDivider: { height: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: "Inter_700Bold", fontSize: 13 },

  notesScroll: { width: "100%", maxHeight: 100 },
  notesLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, textTransform: "uppercase",
                letterSpacing: 0.6, marginBottom: 5 },
  notesText:  { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 20 },

  downloadBtn: {
    width: "100%", backgroundColor: "#1565C0", borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16,
  },
  downloadBtnText: { color: "#FFF", fontFamily: "Inter_700Bold", fontSize: 16 },

  contactBox: {
    width: "100%", borderRadius: 12, borderWidth: 1,
    flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14,
  },
  contactText: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, flex: 1 },

  footNote: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 4 },
});
