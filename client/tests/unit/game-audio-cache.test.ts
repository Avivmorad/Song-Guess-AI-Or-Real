import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGameAudioPlaylist } = vi.hoisted(() => ({
  getGameAudioPlaylist: vi.fn(),
}));

vi.mock("@/lib/supabase/game-api", () => ({
  getGameAudioPlaylist,
}));

import {
  clearGameAudioCache,
  getGameAudioElement,
  getPrefetchedAudioUrl,
  prefetchGameAudio,
  unlockGameAudio,
} from "@/lib/audio/game-audio-cache";

describe("whole-game audio cache", () => {
  beforeEach(() => {
    clearGameAudioCache("CACHE1");
    getGameAudioPlaylist.mockReset();
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock() {
        const listeners = new Map<string, () => void>();
        return {
          src: "",
          volume: 0.8,
          preload: "",
          currentTime: 0,
          play: vi.fn().mockResolvedValue(undefined),
          pause: vi.fn(),
          addEventListener: vi.fn(
            (event: string, listener: () => void) =>
              void listeners.set(event, listener),
          ),
          removeEventListener: vi.fn((event: string) =>
            listeners.delete(event),
          ),
          load: vi.fn(() =>
            queueMicrotask(() => listeners.get("loadeddata")?.()),
          ),
        };
      }),
    );
  });

  it("unlocks one shared player from an existing lobby gesture", async () => {
    const audio = {
      src: "",
      volume: 0.8,
      preload: "",
      currentTime: 0,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
    };
    const AudioConstructor = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal("Audio", AudioConstructor);

    await expect(unlockGameAudio()).resolves.toBe(true);

    expect(AudioConstructor).toHaveBeenCalledTimes(1);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(audio.volume).toBe(0.8);
    expect(getGameAudioElement()).toBe(audio);
  });

  it("downloads every round once and reuses the cached object URLs", async () => {
    const createObjectURL = vi
      .fn()
      .mockImplementation(
        () => `blob:track-${createObjectURL.mock.calls.length}`,
      );
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    const fetchAudio = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["audio"])),
    });
    vi.stubGlobal("fetch", fetchAudio);
    getGameAudioPlaylist.mockResolvedValue([
      { round_id: "round-1", audio_url: "https://audio.test/1" },
      { round_id: "round-2", audio_url: "https://audio.test/2" },
      { round_id: "round-3", audio_url: "https://audio.test/3" },
    ]);
    const progress: Array<[number, number]> = [];

    await prefetchGameAudio("cache1", (ready, total) =>
      progress.push([ready, total]),
    );
    await prefetchGameAudio("CACHE1");

    expect(getGameAudioPlaylist).toHaveBeenCalledTimes(1);
    expect(fetchAudio).toHaveBeenCalledTimes(3);
    expect(progress).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(getPrefetchedAudioUrl("CACHE1", "round-2")).toBe("blob:track-2");

    clearGameAudioCache("CACHE1");
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("keeps completed tracks and retries only a missing download", async () => {
    const createObjectURL = vi
      .fn()
      .mockImplementation(
        () => `blob:retry-${createObjectURL.mock.calls.length}`,
      );
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    getGameAudioPlaylist.mockResolvedValue([
      { round_id: "round-a", audio_url: "https://audio.test/a" },
      { round_id: "round-b", audio_url: "https://audio.test/b" },
    ]);
    let failB = true;
    const fetchAudio = vi.fn(async (url: string) => {
      if (url.endsWith("/b") && failB) {
        failB = false;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: false };
      }
      return {
        ok: true,
        blob: () => Promise.resolve(new Blob([url])),
      };
    });
    vi.stubGlobal("fetch", fetchAudio);

    await expect(prefetchGameAudio("retry1")).rejects.toThrow(
      "AUDIO_DOWNLOAD_FAILED",
    );
    expect(getPrefetchedAudioUrl("retry1", "round-a")).toMatch(/^blob:retry-/);

    await expect(prefetchGameAudio("retry1")).resolves.toHaveProperty(
      "size",
      2,
    );
    expect(
      fetchAudio.mock.calls.filter(([url]) => String(url).endsWith("/a")),
    ).toHaveLength(1);
    expect(
      fetchAudio.mock.calls.filter(([url]) => String(url).endsWith("/b")),
    ).toHaveLength(2);
  });

  it("turns a stalled download into a recoverable timeout", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(),
        revokeObjectURL: vi.fn(),
      });
      getGameAudioPlaylist.mockResolvedValue([
        { round_id: "round-timeout", audio_url: "https://audio.test/stall" },
      ]);
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_url: string, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError")),
              );
            }),
        ),
      );

      const load = prefetchGameAudio("stall1");
      const rejection = expect(load).rejects.toThrow("AUDIO_DOWNLOAD_FAILED");
      await vi.advanceTimersByTimeAsync(20_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
