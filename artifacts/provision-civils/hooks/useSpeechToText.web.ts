import { useState, useCallback, useRef } from "react";

export interface SpeechToTextResult {
  isListening: boolean;
  isAvailable: boolean;
  partialTranscript: string;
  startListening: (onResult: (text: string) => void, lang?: string) => Promise<void>;
  stopListening: () => void;
}

const FALLBACK: Record<string, string | undefined> = {
  "af-ZA": "en-ZA",
  "en-ZA": "en-US",
};

const SR =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null
    : null;

export function useSpeechToText(): SpeechToTextResult {
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(!!SR);
  const [partialTranscript, setPartialTranscript] = useState("");
  const recRef = useRef<any>(null);
  const startRef = useRef<((onResult: (t: string) => void, lang: string) => void) | null>(null);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    recRef.current = null;
    setIsListening(false);
    setPartialTranscript("");
  }, []);

  const startListening = useCallback(
    async (onResult: (text: string) => void, lang = "af-ZA") => {
      if (!SR) { setIsAvailable(false); return; }

      try { recRef.current?.stop(); } catch {}
      recRef.current = null;

      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => { setIsListening(true); setPartialTranscript(""); };
      rec.onend = () => { setIsListening(false); setPartialTranscript(""); recRef.current = null; };

      rec.onerror = (event: any) => {
        const err: string = event.error ?? "";
        if (err === "language-not-supported") {
          const next = FALLBACK[lang];
          if (next && startRef.current) {
            recRef.current = null;
            setIsListening(false);
            setPartialTranscript("");
            setTimeout(() => startRef.current!(onResult, next), 80);
            return;
          }
        }
        if (err === "not-allowed" || err === "service-not-allowed") setIsAvailable(false);
        setIsListening(false);
        setPartialTranscript("");
        recRef.current = null;
      };

      rec.onresult = (event: any) => {
        const result = event.results[event.resultIndex];
        if (!result) return;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          if (text.trim()) onResult(text.trim());
          setPartialTranscript("");
        } else {
          setPartialTranscript(text);
        }
      };

      try { rec.start(); recRef.current = rec; } catch { setIsAvailable(false); }
    },
    []
  );

  startRef.current = startListening;

  return { isListening, isAvailable, partialTranscript, startListening, stopListening };
}
