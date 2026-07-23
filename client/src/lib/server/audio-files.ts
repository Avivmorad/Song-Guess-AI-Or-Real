import { createHash } from "node:crypto";
import { isIP } from "node:net";

export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateIpv4(host: string): boolean {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

export function validateRemoteAudioUrl(raw: string | URL): URL {
  const url = raw instanceof URL ? new URL(raw) : new URL(raw);
  if (url.protocol !== "https:") throw new Error("UNSAFE_AUDIO_URL");
  const host = url.hostname.toLowerCase();
  const unwrappedHost =
    host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  const ipVersion = isIP(unwrappedHost);
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (ipVersion === 4 && isPrivateIpv4(unwrappedHost)) ||
    (ipVersion === 6 &&
      (unwrappedHost === "::" ||
        unwrappedHost === "::1" ||
        unwrappedHost.startsWith("fe8") ||
        unwrappedHost.startsWith("fe9") ||
        unwrappedHost.startsWith("fea") ||
        unwrappedHost.startsWith("feb") ||
        unwrappedHost.startsWith("fc") ||
        unwrappedHost.startsWith("fd") ||
        unwrappedHost.startsWith("::ffff:")))
  ) {
    throw new Error("UNSAFE_AUDIO_URL");
  }
  return url;
}

async function fetchRemoteAudio(
  rawUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  let url = validateRemoteAudioUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, { signal, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;
    if (redirect === MAX_REDIRECTS) throw new Error("AUDIO_REDIRECT_LIMIT");
    const location = response.headers.get("location");
    if (!location) throw new Error("AUDIO_DOWNLOAD_FAILED");
    url = validateRemoteAudioUrl(new URL(location, url));
  }
  throw new Error("AUDIO_REDIRECT_LIMIT");
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error("AUDIO_FILE_TOO_LARGE");
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new Error("AUDIO_FILE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

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
  const response = await fetchRemoteAudio(url, signal);
  if (!response.ok) throw new Error("AUDIO_DOWNLOAD_FAILED");
  const bytes = await readBoundedBody(response);
  if (bytes.length === 0 || bytes.length > MAX_AUDIO_BYTES) {
    throw new Error(
      bytes.length === 0 ? "INVALID_AUDIO_FILE" : "AUDIO_FILE_TOO_LARGE",
    );
  }
  return stripMp3Metadata(bytes);
}
