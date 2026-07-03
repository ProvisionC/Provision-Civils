import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";

type Props = {
  uri: string;
  durationMs: number;
  isMe: boolean;
  colors: any;
};

export default function VoicePlayer({ uri, durationMs, isMe, colors }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  const textColor = isMe ? "#FFF" : colors.foreground;
  const subColor = isMe ? "rgba(255,255,255,0.7)" : colors.mutedForeground;
  const trackBg = isMe ? "rgba(255,255,255,0.25)" : colors.border;
  const fillBg = isMe ? "#FFF" : colors.primary;

  async function togglePlay() {
    if (playing) {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
      return;
    }
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, rate: speed, shouldCorrectPitch: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) { setPlaying(false); setProgress(0); soundRef.current?.unloadAsync(); soundRef.current = null; return; }
          const dur = status.durationMillis ?? durationMs;
          setProgress(dur > 0 ? (status.positionMillis / dur) : 0);
        },
      );
      soundRef.current = sound;
    } else {
      await soundRef.current.playAsync();
    }
    setPlaying(true);
  }

  async function cycleSpeed() {
    const next = speed === 1.0 ? 1.5 : speed === 1.5 ? 2.0 : 1.0;
    setSpeed(next);
    await soundRef.current?.setRateAsync(next, true);
  }

  function formatMs(ms: number) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : colors.primary + "20" }]}>
        <Feather name={playing ? "pause" : "play"} size={16} color={isMe ? "#FFF" : colors.primary} />
      </TouchableOpacity>

      <View style={styles.track}>
        <View style={[styles.bar, { backgroundColor: trackBg }]}>
          <View style={[styles.fill, { backgroundColor: fillBg, width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={[styles.dur, { color: subColor }]}>{formatMs(durationMs)}</Text>
      </View>

      <TouchableOpacity onPress={cycleSpeed} style={styles.speedBtn}>
        <Text style={[styles.speedTxt, { color: subColor }]}>{speed}×</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 160 },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  track: { flex: 1, gap: 4 },
  bar: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  dur: { fontSize: 10 },
  speedBtn: { padding: 4 },
  speedTxt: { fontSize: 11, fontWeight: "700" },
});
