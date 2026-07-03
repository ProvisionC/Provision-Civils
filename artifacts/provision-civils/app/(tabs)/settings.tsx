import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Platform, useColorScheme, ActivityIndicator, Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAppUpdate } from "@/hooks/useAppUpdate";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

function SettingRow({ icon, label, value, onPress, destructive, right }: {
  icon: string; label: string; value?: string; onPress?: () => void;
  destructive?: boolean; right?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[styles.rowIcon, { backgroundColor: (destructive ? colors.destructive : colors.primary) + "15" }]}>
        <Feather name={icon as any} size={18} color={destructive ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
      {right ?? (
        <>
          {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
          {!destructive && onPress && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
        </>
      )}
    </TouchableOpacity>
  );
}

function UpdateStatusBadge({ status }: { status: string }) {
  const colors = useColors();
  if (status === "checking") return <ActivityIndicator size="small" color={colors.primary} />;
  if (status === "up-to-date") {
    return (
      <View style={[styles.badge, { backgroundColor: "#22C55E20" }]}>
        <Feather name="check-circle" size={13} color="#22C55E" />
        <Text style={[styles.badgeText, { color: "#22C55E" }]}>Up to date</Text>
      </View>
    );
  }
  if (status === "ota-ready") {
    return (
      <View style={[styles.badge, { backgroundColor: "#1565C020" }]}>
        <Feather name="download-cloud" size={13} color="#1565C0" />
        <Text style={[styles.badgeText, { color: "#1565C0" }]}>Ready to apply</Text>
      </View>
    );
  }
  if (status === "update-available" || status === "force-update") {
    return (
      <View style={[styles.badge, { backgroundColor: "#FF6F0020" }]}>
        <Feather name="alert-circle" size={13} color="#FF6F00" />
        <Text style={[styles.badgeText, { color: "#FF6F00" }]}>Update available</Text>
      </View>
    );
  }
  return null;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, biometricAvailable, biometricEnabled, enableBiometric, disableBiometric } = useAuth();
  const scheme = useColorScheme();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  const { updateStatus, serverVersion, isChecking, checkForUpdates, applyOtaUpdate, isOtaReady } = useAppUpdate();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const handleCheckUpdate = async () => {
    await checkForUpdates();
    if (updateStatus === "up-to-date") {
      Alert.alert("Up to date", `You're running the latest version (v${APP_VERSION}).`);
    }
  };

  const handleBiometricToggle = async (val: boolean) => {
    if (val) {
      const ok = await enableBiometric();
      if (!ok) Alert.alert("Failed", "Could not enable biometric login. Please try again.");
    } else {
      Alert.alert("Disable Biometrics", "Disable biometric login?", [
        { text: "Cancel", style: "cancel" },
        { text: "Disable", style: "destructive", onPress: () => disableBiometric() },
      ]);
    }
  };

  const initials = user?.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() ?? "??";
  const isAdmin = user?.role === "admin";

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPad + 16, paddingBottom: bottomPad + 100 }}
    >
      <Text style={[styles.title, { color: colors.foreground, paddingHorizontal: 16 }]}>Settings</Text>

      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
          <Text style={[styles.profileRole, { color: colors.primary }]}>
            {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1).replace("_", " ") : ""}
          </Text>
        </View>
      </View>

      {/* Appearance */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>APPEARANCE</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="sun" label="Theme" value={scheme === "dark" ? "Dark" : "Light"} />
      </View>

      {/* Security */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>SECURITY</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {biometricAvailable && (
          <SettingRow
            icon="lock"
            label="Biometric Login"
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ true: colors.primary }}
                thumbColor="#fff"
              />
            }
          />
        )}
        <SettingRow
          icon="clock"
          label="Auto-logout"
          value="After 15 min inactivity"
        />
      </View>

      {/* Account */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="user" label="Profile" value={user?.name ?? ""} />
        <SettingRow icon="phone" label="Phone" value={user?.phone ?? "Not set"} />
      </View>

      {/* App / Updates */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>APP</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow
          icon="info"
          label="Version"
          right={
            <View style={styles.versionRight}>
              <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>v{APP_VERSION}</Text>
              <UpdateStatusBadge status={updateStatus} />
            </View>
          }
        />
        <SettingRow
          icon="download-cloud"
          label={isOtaReady ? "Restart to Apply Update" : "Check for Updates"}
          onPress={isOtaReady ? applyOtaUpdate : handleCheckUpdate}
          right={
            isChecking
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          }
        />
        {serverVersion && (
          <SettingRow
            icon="server"
            label="Latest Release"
            value={`v${serverVersion.version} · ${serverVersion.buildDate}`}
          />
        )}
      </View>

      {/* Admin Tools */}
      {isAdmin && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ADMIN — OPERATIONS</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="settings"
              label="Company Settings"
              onPress={() => router.push("/admin/company-settings" as any)}
            />
            <SettingRow
              icon="database"
              label="Database Backups"
              onPress={() => router.push("/admin/backups" as any)}
            />
            <SettingRow
              icon="trash-2"
              label="Recycle Bin"
              onPress={() => router.push("/admin/recycle-bin" as any)}
            />
          </View>

          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ADMIN — MONITORING</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="activity"
              label="System Status"
              onPress={() => router.push("/admin/system-status" as any)}
            />
            <SettingRow
              icon="list"
              label="Audit Log"
              onPress={() => router.push("/admin/audit-log" as any)}
            />
            <SettingRow
              icon="users"
              label="User Activity"
              onPress={() => router.push("/admin/user-activity" as any)}
            />
            <SettingRow
              icon="alert-triangle"
              label="Crash Reports"
              onPress={() => router.push("/admin/crash-reports" as any)}
            />
            <SettingRow
              icon="users"
              label="Manage Teams"
              onPress={() => router.push("/teams" as any)}
            />
          </View>
        </>
      )}

      {/* PM tools (non-admin) */}
      {user?.role === "project_manager" && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ADMIN</Text>
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="users"
              label="Manage Teams"
              onPress={() => router.push("/teams" as any)}
            />
          </View>
        </>
      )}

      {/* About */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ABOUT</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SettingRow icon="shield" label="Provision Civils" value="© 2025" />
        <SettingRow icon="layers" label="Platform" value="Provision Field Suite" />
      </View>

      {/* Sign Out */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, marginHorizontal: 16 }]}>
        <SettingRow icon="log-out" label="Sign Out" onPress={handleLogout} destructive />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  title:  { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 20 },
  profileCard: {
    borderRadius: 14, padding: 16, borderWidth: 1,
    flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24,
  },
  avatar:      { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText:  { fontSize: 20, fontFamily: "Inter_700Bold" },
  profileInfo: { gap: 2, flex: 1 },
  profileName:  { fontSize: 17, fontFamily: "Inter_700Bold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileRole:  { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },

  sectionHeader: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8,
    paddingHorizontal: 16, marginBottom: 8, marginTop: 8,
  },
  section: {
    borderRadius: 14, borderWidth: 1, marginHorizontal: 16, marginBottom: 8, overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, gap: 12, borderBottomWidth: 1,
  },
  rowIcon:  { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },

  versionRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
});
