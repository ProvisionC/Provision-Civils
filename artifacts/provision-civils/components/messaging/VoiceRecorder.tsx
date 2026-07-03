import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";

type Props = {
  onRecorded: (uri: string, durationMs: number) => void;
  onCancel: () => void;
  colors: any;
};

export default function VoiceRecorder({ onRecorded, onCancel, colors }: Props) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert("Permission denied", "Microphone access is required"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setDuration(0);
      intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      Alert.alert("Error", "Could not start recording");
    }
  }

  async function stopRecording() {
    if (!recording) return;
    clearInterval(intervalRef.current!);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    const status = await recording.getStatusAsync();
    const durationMs = (status as any).durationMillis ?? duration * 1000;
    setRecording(null);
    if (uri) onRecorded(uri, durationMs);
  }

  function cancelRecording() {
    clearInterval(intervalRef.current!);
    recording?.stopAndUnloadAsync().catch(() => {});
    setRecording(null);
    onCancel();
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity onPress={cancelRecording} style={styles.cancelBtn}>
        <Feather name="x" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <View style={styles.center}>
        {recording ? (
          <>
            <View style={[styles.pulse, { backgroundColor: "#EF444430" }]}>
              <View style={[styles.dot, { backgroundColor: "#EF4444" }]} />
            </View>
            <Text style={[styles.timer, { color: colors.foreground }]}>{formatDuration(duration)}</Text>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Recording…</Text>
          </>
        ) : (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap mic to start</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={recording ? stopRecording : startRecording}
        style={[styles.micBtn, { backgroundColor: recording ? "#EF4444" : colors.primary }]}
      >
        <Feather name={recording ? "square" : "mic"} size={22} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, gap: 12 },
  cancelBtn: { padding: 6 },
  center: { flex: 1, alignItems: "center" },
  pulse: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  dot: { width: 18, height: 18, borderRadius: 9 },
  timer: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  hint: { fontSize: 12, marginTop: 2 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
