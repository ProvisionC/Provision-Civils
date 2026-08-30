import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, View, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSpeechToText } from '../hooks/useSpeechToText';

export function VoiceNoteInput({ onResult }: { onResult: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [manualText, setManualText] = useState("");
  const colors = useColors();
  const { startListening, stopListening, isAvailable } = useSpeechToText();

  const toggleRecording = async () => {
    if (isRecording) {
      stopListening();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      try {
        await startListening((text) => {
          onResult(text);
          setIsRecording(false);
        }, 'af-ZA');
      } catch (e) {
        console.error(e);
        setIsRecording(false);
      }
    }
  };

  if (!isAvailable) {
    return (
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.input, color: colors.foreground }]}
          placeholder="Type note..."
          value={manualText}
          onChangeText={setManualText}
        />
        <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={() => { onResult(manualText); setManualText(""); }}>
          <Feather name="send" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={toggleRecording} style={[styles.button, {backgroundColor: isRecording ? colors.destructive : colors.primary}]}>
      <Feather name={isRecording ? 'stop-circle' : 'mic'} size={24} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 15, borderRadius: 30, alignItems: 'center' },
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { flex: 1, padding: 10, borderRadius: 8 },
  sendButton: { padding: 12, borderRadius: 8 },
});
