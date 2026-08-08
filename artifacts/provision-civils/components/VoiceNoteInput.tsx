import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useSpeechToText } from '../hooks/useSpeechToText';

export function VoiceNoteInput({ onResult }: { onResult: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const colors = useColors();
  const { startListening, stopListening } = useSpeechToText();

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

  return (
    <TouchableOpacity onPress={toggleRecording} style={[styles.button, {backgroundColor: isRecording ? colors.destructive : colors.primary}]}>
      <Feather name={isRecording ? 'stop-circle' : 'mic'} size={24} color="#FFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 15, borderRadius: 30, alignItems: 'center' }
});
