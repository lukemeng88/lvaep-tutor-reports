"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Tracks in-flight saves so a small indicator can show Saving / Saved.
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const inFlight = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const track = useCallback(async <T,>(work: () => Promise<T>): Promise<T> => {
    inFlight.current += 1;
    setStatus("saving");
    try {
      const result = await work();
      return result;
    } finally {
      inFlight.current -= 1;
      if (inFlight.current === 0) {
        setStatus("saved");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus("idle"), 2000);
      }
    }
  }, []);

  const markError = useCallback(() => setStatus("error"), []);

  return { status, track, markError };
}
