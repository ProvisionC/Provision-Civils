import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Voice from '@react-native-voice/voice';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export function VoiceNoteInput({ onResult }: { onResult: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const colors = useColors();

  useEffect(() => {
    Voice.onSpeechResults = (e) => { if (e.value) onResult(e.value[0]); };
    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, [onResult]);

  const toggleRecording = async () => {
    if (isRecording) {
      await Voice.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      await Voice.start('af-ZA'); // Support Afrikaans
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
