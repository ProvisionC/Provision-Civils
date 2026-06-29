import { useState, useCallback, useRef } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

export interface SpeechToTextResult {
  isListening: boolean;
  isAvailable: boolean;
  partialTranscript: string;
  startListening: (onResult: (text: string) => void, lang?: string) => Promise<void>;
  stopListening: () => void;
}

export function useSpeechToText(): SpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [partialTranscript, setPartialTranscript] = useState("");
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const finalRef = useRef("");

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setPartialTranscript("");
    finalRef.current = "";
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setPartialTranscript("");
    if (finalRef.current && onResultRef.current) {
      onResultRef.current(finalRef.current);
      finalRef.current = "";
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript ?? "";
    if (event.isFinal) {
      finalRef.current = transcript;
    } else {
      setPartialTranscript(transcript);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      setIsAvailable(false);
    }
    setIsListening(false);
    setPartialTranscript("");
    finalRef.current = "";
  });

  const startListening = useCallback(
    async (onResult: (text: string) => void, lang = "af-ZA") => {
      onResultRef.current = onResult;

      try {
        const available = await ExpoSpeechRecognitionModule.isAvailableAsync();
        if (!available) {
          setIsAvailable(false);
          return;
        }

        const { granted } =
          await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) {
          setIsAvailable(false);
          return;
        }

        ExpoSpeechRecognitionModule.start({
          lang,
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
        });
      } catch (e) {
        setIsAvailable(false);
        setIsListening(false);
      }
    },
    []
  );

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { isListening, isAvailable, partialTranscript, startListening, stopListening };
}
