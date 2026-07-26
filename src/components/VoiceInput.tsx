"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ===========================================================================
// Speech-to-text via the Web Speech API.
//
// Support is uneven — Chrome and Safari have it (prefixed), Firefox does not —
// so the hook reports availability and every caller renders the mic only when
// it will actually work. Nothing here is required to use the field: the mic is
// strictly additive to typing.
// ===========================================================================

type Recognition = any;

function getRecognitionCtor(): any | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition ??
    null
  );
}

export function useDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  // Keep the newest callback without restarting recognition on every render.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* already stopped */
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    setError(null);

    const rec: Recognition = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let said = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) said += event.results[i][0].transcript;
      }
      const text = said.trim();
      if (text) onTextRef.current(text);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        setError("Microphone permission denied.");
      } else if (e?.error === "no-speech") {
        setError("Didn't catch that — try again.");
      } else if (e?.error !== "aborted") {
        setError("Voice input failed.");
      }
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start voice input.");
    }
  }, []);

  return { supported, listening, error, start, stop };
}

/**
 * Mic button. Appends dictated text to whatever is already there rather than
 * replacing it, so speaking never destroys typing.
 */
export function VoiceButton({
  onText,
  disabled,
  label = "Dictate",
  className = "",
}: {
  onText: (text: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const { supported, listening, error, start, stop } = useDictation(onText);
  if (!supported) return null;

  return (
    <span className={"inline-flex items-center gap-2 " + className}>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-label={listening ? "Stop dictating" : label}
        aria-pressed={listening}
        title={listening ? "Stop" : label}
        className={
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-card border transition-colors disabled:opacity-50 " +
          (listening
            ? "animate-pulse border-clay bg-clay/15 text-clay"
            : "border-line text-muted hover:border-teal hover:text-teal")
        }
      >
        <MicIcon />
      </button>
      {error && <span className="text-xs text-clay">{error}</span>}
      {listening && !error && (
        <span className="text-xs text-clay">Listening…</span>
      )}
    </span>
  );
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18.5V22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Appends dictated speech onto existing text with sane spacing. */
export function appendSpoken(existing: string, spoken: string): string {
  const base = existing.trimEnd();
  if (!base) return spoken;
  return /[.!?]$/.test(base) ? `${base} ${spoken}` : `${base} ${spoken}`;
}
