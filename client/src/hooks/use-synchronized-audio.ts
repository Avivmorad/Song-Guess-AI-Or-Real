"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveRound, RoomPhase } from "@/lib/game/types";

export type AudioState =
  "idle" | "loading" | "ready" | "playing" | "blocked" | "error" | "ended";

export function useSynchronizedAudio({
  round,
  phase,
  serverOffsetMs,
  volume,
}: {
  round: ActiveRound | null;
  phase: RoomPhase;
  serverOffsetMs: number;
  volume: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const roundId = round?.id ?? null;
  const audioUrl = round?.audio_url ?? null;
  const startsAt = round?.starts_at ?? null;
  const audioDurationSeconds = round?.audio_duration_seconds ?? 0;

  const synchronize = useCallback(
    async (userInitiated = false) => {
      const audio = audioRef.current;
      if (!audio || !roundId || !startsAt) return;
      audio.muted = muted;
      audio.volume = Math.max(0, Math.min(1, volume));

      if (phase !== "playing") {
        audio.pause();
        if (phase === "countdown") audio.currentTime = 0;
        return;
      }

      const elapsedSeconds = Math.max(
        0,
        (Date.now() + serverOffsetMs - new Date(startsAt).getTime()) / 1000,
      );
      const maximum = Number.isFinite(audio.duration)
        ? Math.max(0, audio.duration - 0.05)
        : audioDurationSeconds;
      const target = Math.min(elapsedSeconds, maximum);
      if (Math.abs(audio.currentTime - target) > 0.65)
        audio.currentTime = target;

      try {
        await audio.play();
        setAudioState("playing");
      } catch {
        setAudioState(userInitiated ? "error" : "blocked");
      }
    },
    [
      audioDurationSeconds,
      muted,
      phase,
      roundId,
      serverOffsetMs,
      startsAt,
      volume,
    ],
  );

  useEffect(() => {
    if (!roundId || !audioUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audioRef.current = audio;
    const loadingUpdate = window.setTimeout(() => {
      setAudioState("loading");
      setProgress(0);
    }, 0);

    const handleReady = () => setAudioState("ready");
    const handleError = () => setAudioState("error");
    const handleEnded = () => setAudioState("ended");
    audio.addEventListener("canplaythrough", handleReady, { once: true });
    audio.addEventListener("error", handleError);
    audio.addEventListener("ended", handleEnded);
    audio.load();

    return () => {
      window.clearTimeout(loadingUpdate);
      audio.pause();
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("ended", handleEnded);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [audioUrl, roundId]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => void synchronize(false), 0);
    return () => window.clearTimeout(syncTimer);
  }, [synchronize]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0)
        return;
      setProgress(Math.max(0, Math.min(1, audio.currentTime / audio.duration)));
      if (phase === "playing") void synchronize(false);
    }, 500);
    return () => window.clearInterval(interval);
  }, [phase, synchronize]);

  return {
    audioState: roundId ? audioState : "idle",
    progress: roundId ? progress : 0,
    muted,
    activate: () => synchronize(true),
    toggleMuted: () => setMuted((current) => !current),
  };
}
