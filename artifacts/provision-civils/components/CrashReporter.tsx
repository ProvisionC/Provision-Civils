import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createCrashReport } from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

export class CrashReporter extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  async componentDidCatch(error: Error, info: React.ErrorInfo) {
    let userId: number | undefined;
    let userName: string | undefined;

    try {
      const stored = await AsyncStorage.getItem("auth_user");
      if (stored) {
        const user = JSON.parse(stored) as { id: number; name: string };
        userId = user.id;
        userName = user.name;
      }
    } catch { /* ignore */ }

    try {
      await createCrashReport({
        appVersion: APP_VERSION,
        platform: Platform.OS,
        deviceInfo: {
          os: Platform.OS,
          osVersion: Platform.Version,
          brand: (Platform as unknown as Record<string, unknown>).brand,
          model: (Platform as unknown as Record<string, unknown>).model,
          userId,
          userName,
        },
        errorMessage: error.message,
        stackTrace: error.stack ?? info.componentStack ?? "",
        extraContext: {
          componentStack: info.componentStack,
        },
      });
      this.setState({ reported: true });
    } catch { /* report failed silently */ }
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null, reported: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Feather name="alert-triangle" size={48} color="#EF5350" />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          {this.state.reported
            ? "The error has been automatically reported to your admin."
            : "An unexpected error occurred."}
        </Text>
        <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 12 }}>
          <Text style={styles.errorText}>{this.state.error?.message}</Text>
        </ScrollView>
        <TouchableOpacity style={styles.restartBtn} onPress={this.handleRestart}>
          <Feather name="refresh-cw" size={18} color="#fff" />
          <Text style={styles.restartBtnText}>Restart App</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#0D1117", alignItems: "center",
    justifyContent: "center", padding: 24,
  },
  iconWrap: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#E8EDF5", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94A3B8", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  errorBox: {
    backgroundColor: "#161B22", borderRadius: 10, width: "100%",
    maxHeight: 160, marginBottom: 24,
  },
  errorText: { fontSize: 12, color: "#EF5350", fontFamily: "monospace", lineHeight: 18 },
  restartBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1565C0", paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12,
  },
  restartBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
