import { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
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
  const langRef = useRef("af-ZA");

  // Check availability on mount
  useEffect(() => {
    ExpoSpeechRecognitionModule.isAvailableAsync()
      .then((available: boolean) => { if (!available) setIsAvailable(false); })
      .catch(() => setIsAvailable(false));
  }, []);

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
      onResultRef.current = null;
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
    const err = event.error ?? "";
    setIsListening(false);
    setPartialTranscript("");
    finalRef.current = "";

    if (err === "not-allowed" || err === "service-not-allowed") {
      setIsAvailable(false);
      Alert.alert(
        "Microphone Permission Required",
        "Please allow microphone access to use voice recording. Go to your device Settings → App → Microphone.",
        [{ text: "OK" }]
      );
    } else if (err === "no-speech") {
      Alert.alert("No Speech Detected", "Nothing was heard. Please tap the mic button and speak clearly.", [{ text: "OK" }]);
    } else if (err === "language-not-supported") {
      // Silently fall back — handled by retrying with en-US
      const nextLang = langRef.current === "af-ZA" ? "en-ZA" : langRef.current === "en-ZA" ? "en-US" : null;
      if (nextLang && onResultRef.current) {
        const cb = onResultRef.current;
        langRef.current = nextLang;
        setTimeout(() => {
          ExpoSpeechRecognitionModule.start({ lang: nextLang, interimResults: true, continuous: false });
        }, 200);
        return;
      }
    }
    onResultRef.current = null;
  });

  const startListening = useCallback(
    async (onResult: (text: string) => void, lang = "af-ZA") => {
      onResultRef.current = onResult;
      langRef.current = lang;

      try {
        const available = await ExpoSpeechRecognitionModule.isAvailableAsync();
        if (!available) {
          setIsAvailable(false);
          Alert.alert(
            "Voice Not Available",
            "Speech recognition is not supported on this device. Please type your notes manually.",
            [{ text: "OK" }]
          );
          return;
        }

        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) {
          setIsAvailable(false);
          Alert.alert(
            "Microphone Permission Required",
            "Microphone access was denied. Go to Settings → Privacy → Microphone and allow this app.",
            [{ text: "OK" }]
          );
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
        Alert.alert("Voice Error", "Could not start speech recognition. Please try again.", [{ text: "OK" }]);
      }
    },
    []
  );

  const stopListening = useCallback(() => {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
  }, []);

  return { isListening, isAvailable, partialTranscript, startListening, stopListening };
}
