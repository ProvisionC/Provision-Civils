import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { startSpeechRecognition, stopSpeechRecognition } from 'expo-speech-recognition';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function VoiceNoteInput({ onResult }: { onResult: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const colors = useColors();

  const toggleRecording = async () => {
    if (isRecording) {
      await stopSpeechRecognition();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      try {
        const result = await startSpeechRecognition({ lang: 'af-ZA' });
        onResult(result.results[0].transcript);
      } catch (e) {
        console.error(e);
      } finally {
        setIsRecording(false);
      }
    }
  };

  return (
    <TouchableOpacity onPress={toggleRecording} style={[styles.button, {backgroundColor: isRecording ? colors.destructive : colors.primary}]}>
      <Feather name={isRecording ? 'stop-circle' : 'mic'} size={24} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 15, borderRadius: 30, alignItems: 'center' }
});
