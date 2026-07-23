import { createHash } from "node:crypto";

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function synchsafeSize(bytes: Uint8Array): number {
  return (
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f)
  );
}

export function stripMp3Metadata(input: Uint8Array): Uint8Array {
  let start = 0;
  let end = input.length;
  if (
    input.length >= 10 &&
    input[0] === 0x49 &&
    input[1] === 0x44 &&
    input[2] === 0x33
  ) {
    const footerSize = (input[5] & 0x10) !== 0 ? 10 : 0;
    start = Math.min(input.length, 10 + synchsafeSize(input) + footerSize);
  }
  if (
    end - start >= 128 &&
    input[end - 128] === 0x54 &&
    input[end - 127] === 0x41 &&
    input[end - 126] === 0x47
  ) {
    end -= 128;
  }
  const stripped = input.slice(start, end);
  if (
    stripped.length < 2 ||
    stripped[0] !== 0xff ||
    (stripped[1] & 0xe0) !== 0xe0
  ) {
    throw new Error("INVALID_AUDIO_FILE");
  }
  return stripped;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function downloadAudio(
  url: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal, redirect: "follow" });
  if (!response.ok) throw new Error("AUDIO_DOWNLOAD_FAILED");
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error("AUDIO_FILE_TOO_LARGE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
    throw new Error(
      bytes.length === 0 ? "INVALID_AUDIO_FILE" : "AUDIO_FILE_TOO_LARGE",
    );
  }
  return stripMp3Metadata(bytes);
}
