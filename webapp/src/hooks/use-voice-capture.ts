"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export type VoiceCaptureState = "idle" | "listening" | "processing";

interface UseVoiceCaptureOptions {
  lang?: string;
  onResult?: (transcript: string) => void;
}

/**
 * Wraps the Web Speech API (`SpeechRecognition`) for voice-to-text capture.
 * Uses `es-CO` (Colombian Spanish) by default.
 *
 * Returns `null` for `supported` when the API is not available (Firefox, SSR).
 */
export function useVoiceCapture(options: UseVoiceCaptureOptions = {}) {
  const { lang = "es-CO", onResult } = options;
  const [state, setState] = useState<VoiceCaptureState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<webkitSpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = useCallback(() => {
    if (!supported) return;

    setError(null);
    setTranscript("");

    const SpeechRecognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setState("listening");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const results = event.results;
      const current = results[results.length - 1];
      const text = current[0].transcript;
      setTranscript(text);

      if (current.isFinal) {
        setState("processing");
        onResultRef.current?.(text);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg =
        event.error === "no-speech"
          ? "No se detectó voz. Intenta de nuevo."
          : event.error === "not-allowed"
            ? "Permiso de micrófono denegado."
            : `Error de reconocimiento: ${event.error}`;
      setError(msg);
      setState("idle");
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, lang]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setState("idle");
    setTranscript("");
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { supported, state, transcript, error, start, stop, reset };
}
