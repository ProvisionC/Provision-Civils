import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { login as loginApi } from "@workspace/api-client-react";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, biometricAvailable, biometricEnabled, loginWithBiometric } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi({ email: email.trim().toLowerCase(), password });
      await login(res.token, res.user as any);
      router.replace("/(tabs)");
    } catch {
      Alert.alert("Login Failed", "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    setBiometricLoading(true);
    try {
      const success = await loginWithBiometric();
      if (success) {
        router.replace("/(tabs)");
      } else {
        Alert.alert("Biometric Failed", "Could not verify your identity. Please sign in with your password.");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const showBiometricBtn = biometricAvailable && biometricEnabled;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.logoSection}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Feather name="hard-drive" size={36} color="#FFF" />
          </View>
          <Text style={[styles.appName, { color: colors.primary }]}>Provision Civils</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Construction Job Management
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in to your account</Text>

          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {showBiometricBtn && (
            <TouchableOpacity
              style={[styles.biometricBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={handleBiometric}
              disabled={biometricLoading}
              activeOpacity={0.8}
            >
              {biometricLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Feather name="lock" size={18} color={colors.primary} />
                  <Text style={[styles.biometricBtnText, { color: colors.primary }]}>
                    Sign in with Biometrics
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Default: admin@provision.co.za / admin123
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: "center", gap: 24 },
  logoSection: { alignItems: "center", gap: 8 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  appName: { fontSize: 26, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: { borderRadius: 16, padding: 24, borderWidth: 1, gap: 6 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 8 },
  fields: { gap: 16, marginTop: 8 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", borderRadius: 10,
    borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  button: {
    borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  biometricBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 12, paddingVertical: 13, marginTop: 10, borderWidth: 1,
  },
  biometricBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  hint: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular" },
});
