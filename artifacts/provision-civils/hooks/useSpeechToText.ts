import { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";

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

/**
 * Lazily require expo-speech-recognition so that import errors
 * don't crash the screen when the native module is absent (Expo Go).
 */
function getNativeModule(): null | {
  isAvailableAsync(): Promise<boolean>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(opts: object): void;
  stop(): void;
  addListener(event: string, cb: (e: unknown) => void): { remove(): void };
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-speech-recognition");
    const m = mod?.ExpoSpeechRecognitionModule;
    if (m && typeof m.isAvailableAsync === "function") return m;
    return null;
  } catch {
    return null;
  }
}

export function useSpeechToText(): SpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [moduleAvailable, setModuleAvailable] = useState<boolean | null>(null);
  const [partialTranscript, setPartialTranscript] = useState("");

  const bestRef = useRef("");
  const onResultRef = useRef<((text: string) => void) | null>(null);
  const langRef = useRef("af-ZA");
  const retryingRef = useRef(false);

  // ── Availability check on mount ───────────────────────────────────────────
  useEffect(() => {
    const m = getNativeModule();
    if (!m) {
      console.log("[Voice] native module not found — requires custom dev build");
      setModuleAvailable(false);
      return;
    }
    m.isAvailableAsync()
      .then((ok: boolean) => {
        console.log("[Voice] isAvailableAsync:", ok);
        setModuleAvailable(ok);
      })
      .catch((err: unknown) => {
        console.log("[Voice] isAvailableAsync error:", err);
        setModuleAvailable(false);
      });
  }, []);

  // ── Event subscriptions (addListener, not hooks, so they degrade safely) ──
  useEffect(() => {
    const m = getNativeModule();
    if (!m) return;

    const subs: Array<{ remove(): void }> = [];

    try {
      subs.push(
        m.addListener("start", () => {
          console.log("[Voice] event: start");
          setIsListening(true);
          setPartialTranscript("");
          bestRef.current = "";
        })
      );

      subs.push(
        m.addListener("result", (e: unknown) => {
          const event = e as { results?: Array<{ transcript: string }> };
          const text = event?.results?.[0]?.transcript ?? "";
          console.log("[Voice] event: result — transcript:", JSON.stringify(text));
          if (text) {
            bestRef.current = text;
            setPartialTranscript(text);
          }
        })
      );

      subs.push(
        m.addListener("end", () => {
          console.log("[Voice] event: end — bestRef:", JSON.stringify(bestRef.current));
          setIsListening(false);
          setPartialTranscript("");
          const text = bestRef.current.trim();
          bestRef.current = "";
          retryingRef.current = false;
          if (text && onResultRef.current) {
            onResultRef.current(text);
            onResultRef.current = null;
          }
        })
      );

      subs.push(
        m.addListener("error", (e: unknown) => {
          const event = e as { error?: string; message?: string };
          const err = event?.error ?? event?.message ?? "unknown";
          console.log("[Voice] event: error —", err);
          setIsListening(false);
          setPartialTranscript("");

          const partial = bestRef.current.trim();
          bestRef.current = "";

          // Language fallback: try en-ZA then en-US before giving up
          if (err === "language-not-supported" && !retryingRef.current) {
            const next = LANG_FALLBACK[langRef.current] ?? null;
            if (next && onResultRef.current) {
              retryingRef.current = true;
              langRef.current = next;
              console.log("[Voice] retrying with lang:", next);
              setTimeout(() => {
                try {
                  m.start({ lang: next, interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
                } catch (startErr) {
                  console.log("[Voice] retry start failed:", startErr);
                  retryingRef.current = false;
                  onResultRef.current = null;
                  Alert.alert("Voice Error", "Language not supported on this device.", [{ text: "OK" }]);
                }
              }, 300);
              return;
            }
          }

          retryingRef.current = false;

          // If we captured a partial transcript, deliver it despite the error
          if (partial && onResultRef.current) {
            onResultRef.current(partial);
            onResultRef.current = null;
            return;
          }
          onResultRef.current = null;

          if (err === "not-allowed" || err === "service-not-allowed") {
            setModuleAvailable(false);
            Alert.alert(
              "Microphone Permission Denied",
              "Go to Settings → Apps → Provision Civils → Permissions → Microphone → Allow.",
              [{ text: "OK" }]
            );
          } else if (err === "no-speech") {
            Alert.alert("No speech detected", "Nothing was heard. Please tap the mic and speak clearly.", [{ text: "OK" }]);
          } else if (err !== "aborted" && err !== "audio-capture") {
            Alert.alert("Voice Error", `Recognition error: ${err}. Please try again.`, [{ text: "OK" }]);
          }
        })
      );
    } catch (subscribeErr) {
      console.log("[Voice] failed to subscribe to events:", subscribeErr);
    }

    return () => subs.forEach(s => { try { s.remove(); } catch {} });
  }, []);

  // ── startListening ─────────────────────────────────────────────────────────
  const startListening = useCallback(
    async (onResult: (text: string) => void, lang = "af-ZA") => {
      console.log("[Voice] startListening — lang:", lang, "moduleAvailable:", moduleAvailable);

      const m = getNativeModule();
      if (!m) {
        Alert.alert(
          "Voice Not Available",
          "Speech recognition requires a custom development build.\n\nThis feature is not supported in Expo Go.\n\nPlease type your notes manually.",
          [{ text: "OK" }]
        );
        return;
      }

      onResultRef.current = onResult;
      langRef.current = lang;
      retryingRef.current = false;
      bestRef.current = "";

      try {
        const available = await m.isAvailableAsync();
        console.log("[Voice] isAvailableAsync (pre-start):", available);
        if (!available) {
          setModuleAvailable(false);
          Alert.alert(
            "Voice Not Supported",
            "Speech recognition is not supported on this device.",
            [{ text: "OK" }]
          );
          onResultRef.current = null;
          return;
        }

        const { granted } = await m.requestPermissionsAsync();
        console.log("[Voice] mic permission granted:", granted);
        if (!granted) {
          Alert.alert(
            "Microphone Permission Required",
            "Allow microphone access to use voice notes.\n\nGo to Settings → Apps → Provision Civils → Permissions → Microphone → Allow.",
            [{ text: "OK" }]
          );
          onResultRef.current = null;
          return;
        }

        console.log("[Voice] calling m.start()");
        m.start({ lang, interimResults: true, continuous: false, requiresOnDeviceRecognition: false });
      } catch (err) {
        console.log("[Voice] startListening threw:", err);
        setIsListening(false);
        onResultRef.current = null;
        Alert.alert(
          "Voice Error",
          `Could not start recording:\n${err instanceof Error ? err.message : String(err)}`,
          [{ text: "OK" }]
        );
      }
    },
    [moduleAvailable]
  );

  // ── stopListening ──────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    console.log("[Voice] stopListening called");
    const m = getNativeModule();
    try { m?.stop(); } catch {}
  }, []);

  return {
    isListening,
    isAvailable: moduleAvailable !== false, // null (checking) → treat as available
    partialTranscript,
    startListening,
    stopListening,
  };
}
