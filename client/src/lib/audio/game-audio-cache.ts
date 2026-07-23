"use client";

import { getGameAudioPlaylist } from "@/lib/supabase/game-api";

interface CachedAudio {
  objectUrl: string;
  byteLength: number;
}

const roomAudio = new Map<string, Map<string, CachedAudio>>();
const roomLoads = new Map<string, Promise<Map<string, CachedAudio>>>();
const roomExpectedTracks = new Map<string, number>();
let sharedGameAudio: HTMLAudioElement | null = null;

const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACA";

function normalizedRoomCode(code: string) {
  return code.trim().toUpperCase();
}

export function getPrefetchedAudioUrl(
  code: string,
  roundId: string,
): string | null {
  return (
    roomAudio.get(normalizedRoomCode(code))?.get(roundId)?.objectUrl ?? null
  );
}

export function getGameAudioElement() {
  if (!sharedGameAudio) {
    sharedGameAudio = new Audio();
    sharedGameAudio.preload = "auto";
  }
  return sharedGameAudio;
}

export async function unlockGameAudio() {
  const audio = getGameAudioElement();
  const previousVolume = audio.volume;
  try {
    audio.src = SILENT_WAV;
    audio.volume = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  } finally {
    audio.volume = previousVolume;
  }
}

export function clearGameAudioCache(code: string) {
  const key = normalizedRoomCode(code);
  const cached = roomAudio.get(key);
  if (cached) {
    for (const audio of cached.values()) URL.revokeObjectURL(audio.objectUrl);
  }
  roomAudio.delete(key);
  roomLoads.delete(key);
  roomExpectedTracks.delete(key);
  if (sharedGameAudio) {
    sharedGameAudio.pause();
    sharedGameAudio.src = "";
    sharedGameAudio.load?.();
    sharedGameAudio = null;
  }
}

async function verifyCachedAudioIsPlayable(
  downloaded: Map<string, CachedAudio>,
) {
  const audio = getGameAudioElement();
  for (const [roundId, cached] of downloaded) {
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = globalThis.setTimeout(
          () => reject(new Error("AUDIO_DOWNLOAD_FAILED")),
          15_000,
        );
        const cleanup = () => {
          globalThis.clearTimeout(timeout);
          audio.removeEventListener("loadeddata", handleReady);
          audio.removeEventListener("error", handleError);
        };
        const handleReady = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error("AUDIO_DOWNLOAD_FAILED"));
        };
        audio.addEventListener("loadeddata", handleReady, { once: true });
        audio.addEventListener("error", handleError, { once: true });
        audio.src = cached.objectUrl;
        audio.load();
      });
    } catch {
      URL.revokeObjectURL(cached.objectUrl);
      downloaded.delete(roundId);
      throw new Error("AUDIO_DOWNLOAD_FAILED");
    }
  }
  audio.pause();
  audio.currentTime = 0;
}

export async function prefetchGameAudio(
  code: string,
  onProgress?: (downloaded: number, total: number) => void,
) {
  const key = normalizedRoomCode(code);
  const existing = roomAudio.get(key);
  const expected = roomExpectedTracks.get(key);
  if (existing && expected !== undefined && existing.size === expected) {
    onProgress?.(existing.size, expected);
    return existing;
  }
  const active = roomLoads.get(key);
  if (active) return active;

  const load = (async () => {
    const playlist = await getGameAudioPlaylist(key);
    const downloaded = roomAudio.get(key) ?? new Map<string, CachedAudio>();
    roomAudio.set(key, downloaded);
    roomExpectedTracks.set(key, playlist.length);
    let completed = downloaded.size;
    onProgress?.(0, playlist.length);

    try {
      if (completed > 0) onProgress?.(completed, playlist.length);
      const queue = playlist.filter((track) => !downloaded.has(track.round_id));
      const worker = async () => {
        while (queue.length > 0) {
          const track = queue.shift();
          if (!track) return;
          const controller = new AbortController();
          const timeout = globalThis.setTimeout(
            () => controller.abort(),
            20_000,
          );
          let blob: Blob;
          try {
            const response = await fetch(track.audio_url, {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!response.ok) throw new Error("AUDIO_DOWNLOAD_FAILED");
            blob = await response.blob();
            if (blob.size === 0) throw new Error("AUDIO_DOWNLOAD_FAILED");
          } catch {
            throw new Error("AUDIO_DOWNLOAD_FAILED");
          } finally {
            globalThis.clearTimeout(timeout);
          }
          downloaded.set(track.round_id, {
            objectUrl: URL.createObjectURL(blob),
            byteLength: blob.size,
          });
          completed += 1;
          onProgress?.(completed, playlist.length);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(3, playlist.length) }, () => worker()),
      );
      await verifyCachedAudioIsPlayable(downloaded);
      roomAudio.set(key, downloaded);
      return downloaded;
    } catch (error) {
      throw error;
    } finally {
      roomLoads.delete(key);
    }
  })();

  roomLoads.set(key, load);
  return load;
}
