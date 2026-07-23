import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadAudio,
  sha256Hex,
  stripMp3Metadata,
  validateRemoteAudioUrl,
} from "@/lib/server/audio-files";

afterEach(() => vi.unstubAllGlobals());

describe("MP3 sanitization", () => {
  it("removes ID3v2 and ID3v1 metadata without changing audio frames", () => {
    const id3v2 = Uint8Array.from([
      0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 4, 1, 2, 3, 4,
    ]);
    const frame = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 1, 2, 3]);
    const id3v1 = new Uint8Array(128);
    id3v1.set([0x54, 0x41, 0x47]);
    const input = new Uint8Array(id3v2.length + frame.length + id3v1.length);
    input.set(id3v2);
    input.set(frame, id3v2.length);
    input.set(id3v1, id3v2.length + frame.length);

    expect(stripMp3Metadata(input)).toEqual(frame);
  });

  it("rejects content that does not begin with an MP3 frame", () => {
    expect(() => stripMp3Metadata(Uint8Array.from([1, 2, 3]))).toThrow(
      "INVALID_AUDIO_FILE",
    );
  });

  it("produces a stable SHA-256 checksum", () => {
    expect(sha256Hex(Uint8Array.from([1, 2, 3]))).toBe(
      "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    );
  });

  it("accepts HTTPS provider URLs and rejects unsafe download targets", () => {
    expect(
      validateRemoteAudioUrl(
        "https://prod-1.storage.jamendo.com/download/track/1/mp32/",
      ).hostname,
    ).toBe("prod-1.storage.jamendo.com");
    for (const url of [
      "http://example.com/song.mp3",
      "https://localhost/song.mp3",
      "https://127.0.0.1/song.mp3",
      "https://10.2.3.4/song.mp3",
      "https://[::1]/song.mp3",
    ]) {
      expect(() => validateRemoteAudioUrl(url)).toThrow("UNSAFE_AUDIO_URL");
    }
  });

  it("revalidates every redirect before downloading audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://127.0.0.1/private.mp3" },
        }),
      ),
    );
    await expect(
      downloadAudio(
        "https://prod-1.storage.jamendo.com/download/track/1/mp32/",
        new AbortController().signal,
      ),
    ).rejects.toThrow("UNSAFE_AUDIO_URL");
  });
});
