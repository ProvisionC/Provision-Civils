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

const LANG_FALLBACK: Record<string, string | null> = {
  "af-ZA": "en-ZA",
  "en-ZA": "en-US",
  "en-US": null,
};

export function useSpeechToText(): SpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [partialTranscript, setPartialTranscript] = useState("");

  // Track the best transcript received so far — used when 'end' fires
  const bestRef = useRef("");
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const langRef = useRef("af-ZA");

  useEffect(() => {
    ExpoSpeechRecognitionModule.isAvailableAsync()
      .then((ok: boolean) => { if (!ok) setIsAvailable(false); })
      .catch(() => setIsAvailable(false));
  }, []);

  useSpeechRecognitionEvent("start", () => {
    setIsListening(true);
    setPartialTranscript("");
    bestRef.current = "";
  });

  useSpeechRecognitionEvent("result", (event) => {
    const text = event.results[0]?.transcript ?? "";
    if (text) {
      bestRef.current = text; // always keep the latest transcript
      setPartialTranscript(text);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    setPartialTranscript("");
    const text = bestRef.current.trim();
    bestRef.current = "";
    if (text && onResultRef.current) {
      onResultRef.current(text);
      onResultRef.current = null;
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    const err = event.error ?? "";
    setIsListening(false);
    setPartialTranscript("");

    // Deliver any partial transcript we captured before the error
    const partial = bestRef.current.trim();
    bestRef.current = "";

    if (err === "language-not-supported") {
      const next = LANG_FALLBACK[langRef.current] ?? null;
      if (next && onResultRef.current) {
        langRef.current = next;
        // Retry with next language — keep onResultRef
        setTimeout(() => {
          ExpoSpeechRecognitionModule.start({
            lang: next, interimResults: true, continuous: false, requiresOnDeviceRecognition: false,
          });
        }, 300);
        return;
      }
    }

    if (partial && onResultRef.current) {
      onResultRef.current(partial);
      onResultRef.current = null;
      return;
    }
    onResultRef.current = null;

    if (err === "not-allowed" || err === "service-not-allowed") {
      setIsAvailable(false);
      Alert.alert(
        "Microphone Permission Required",
        "Please allow microphone access to use voice notes.\n\nGo to Settings → Apps → Provision Civils → Permissions → Microphone → Allow.",
        [{ text: "OK" }]
      );
    } else if (err === "no-speech") {
      Alert.alert("No Speech Detected", "Nothing was heard. Tap the mic button and speak clearly.", [{ text: "OK" }]);
    } else if (!["aborted", "audio-capture"].includes(err)) {
      // Don't spam user for known non-critical errors
    }
  });

  const startListening = useCallback(
    async (onResult: (text: string) => void, lang = "af-ZA") => {
      onResultRef.current = onResult;
      langRef.current = lang;
      bestRef.current = "";

      try {
        const available = await ExpoSpeechRecognitionModule.isAvailableAsync();
        if (!available) {
          setIsAvailable(false);
          Alert.alert(
            "Voice Not Available",
            "Speech recognition is not supported on this device. Please type your notes manually.",
            [{ text: "OK" }]
          );
          onResultRef.current = null;
          return;
        }

        const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) {
          Alert.alert(
            "Microphone Permission Required",
            "Please allow microphone access to use voice notes.\n\nGo to Settings → Apps → Provision Civils → Permissions → Microphone → Allow.",
            [{ text: "OK" }]
          );
          onResultRef.current = null;
          return;
        }

        ExpoSpeechRecognitionModule.start({
          lang,
          interimResults: true,
          continuous: false,
          requiresOnDeviceRecognition: false,
        });
      } catch (e) {
        setIsListening(false);
        onResultRef.current = null;
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
