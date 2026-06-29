import { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";

export interface SpeechToTextResult {
  isListening: boolean;
  isAvailable: boolean;
  partialTranscript: string;
  startListening: (onResult: (text: string) => void, lang?: string) => Promise<void>;
  stopListening: () => void;
}

function getSR(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

const LANG_ORDER = ["af-ZA", "en-ZA", "en-US"];

export function useSpeechToText(): SpeechToTextResult {
  const SR = getSR();
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [partialTranscript, setPartialTranscript] = useState("");
  const recRef = useRef<any>(null);
  const startRef = useRef<((onResult: (t: string) => void, langs: string[]) => void) | null>(null);

  useEffect(() => {
    if (!SR) setIsAvailable(false);
  }, []);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setIsListening(false);
    setPartialTranscript("");
  }, []);

  const startWithLangs = useCallback(
    (onResult: (text: string) => void, langs: string[]) => {
      const SR2 = getSR();
      if (!SR2) {
        setIsAvailable(false);
        Alert.alert(
          "Voice Not Supported",
          "Your browser does not support speech recognition. Please type your notes manually.",
          [{ text: "OK" }]
        );
        return;
      }

      const lang = langs[0] ?? "en-US";
      const remaining = langs.slice(1);

      try { recRef.current?.stop(); } catch {}
      recRef.current = null;

      const rec = new SR2();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setPartialTranscript("");
      };

      rec.onend = () => {
        setIsListening(false);
        setPartialTranscript("");
        recRef.current = null;
      };

      rec.onerror = (event: any) => {
        const err: string = event.error ?? "";
        recRef.current = null;
        setIsListening(false);
        setPartialTranscript("");

        if (err === "language-not-supported" && remaining.length > 0 && startRef.current) {
          setTimeout(() => startRef.current!(onResult, remaining), 100);
          return;
        }
        if (err === "not-allowed" || err === "service-not-allowed") {
          setIsAvailable(false);
          Alert.alert(
            "Microphone Permission Denied",
            "Please allow microphone access in your browser to use voice recording.\n\nIn Chrome: click the lock icon in the address bar → Microphone → Allow.",
            [{ text: "OK" }]
          );
          return;
        }
        if (err === "no-speech") {
          Alert.alert("No Speech Detected", "Nothing was heard. Please tap the mic button and speak clearly.", [{ text: "OK" }]);
          return;
        }
        if (err === "network") {
          Alert.alert("Network Error", "Speech recognition requires an internet connection. Please check your connection.", [{ text: "OK" }]);
          return;
        }
        // Any remaining unknown error - silent (don't spam the user)
      };

      rec.onresult = (event: any) => {
        const result = event.results[event.resultIndex];
        if (!result) return;
        const text = (result[0]?.transcript ?? "").trim();
        if (result.isFinal) {
          if (text) onResult(text);
          setPartialTranscript("");
        } else {
          setPartialTranscript(text);
        }
      };

      try {
        rec.start();
        recRef.current = rec;
      } catch (e) {
        setIsAvailable(false);
        Alert.alert("Voice Error", "Could not start speech recognition. Please try again.", [{ text: "OK" }]);
      }
    },
    []
  );

  // Keep a stable ref so onerror fallback always has the latest function
  startRef.current = startWithLangs;

  const startListening = useCallback(
    async (onResult: (text: string) => void, _lang = "af-ZA") => {
      if (!getSR()) {
        setIsAvailable(false);
        Alert.alert(
          "Voice Not Supported",
          "Your browser does not support speech recognition. Please type your notes manually.",
          [{ text: "OK" }]
        );
        return;
      }
      startWithLangs(onResult, LANG_ORDER);
    },
    [startWithLangs]
  );

  return { isListening, isAvailable, partialTranscript, startListening, stopListening };
}
