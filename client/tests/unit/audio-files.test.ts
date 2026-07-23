import { describe, expect, it } from "vitest";
import { sha256Hex, stripMp3Metadata } from "@/lib/server/audio-files";

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
});
