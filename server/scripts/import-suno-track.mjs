import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const UNSUPPORTED_DOWNLOAD_HOSTS = [
  "youtube.com",
  "youtu.be",
  "googlevideo.com",
  "spotify.com",
  "scdn.co",
];

for (const envPath of [".env.local", "../.env.local", "../client/.env.local"]) {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Environment files are optional; CI and production pass values directly.
  }
}

function parseArguments(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    const equalsIndex = key.indexOf("=");
    if (equalsIndex > 2) {
      result[key.slice(2, equalsIndex)] = key.slice(equalsIndex + 1);
      continue;
    }
    const value = values[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value for ${key}`);
    result[key.slice(2)] = value;
    index += 1;
  }
  return result;
}

function usage() {
  return [
    "Usage:",
    '  node scripts/import-suno-track.mjs --file=./song.mp3 --title="Song" --artist="Artist" --duration=180 --source-url=https://suno.com/song/...',
    '  node scripts/import-suno-track.mjs --download-url=https://.../song.mp3 --title="Song" --artist="Artist" --duration=180 --source-url=https://suno.com/playlist/...',
  ].join("\n");
}

function synchsafeSize(bytes) {
  return (
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f)
  );
}

function sanitizeMp3(input) {
  let start = 0;
  let end = input.length;
  if (input.length >= 10 && input.subarray(0, 3).toString() === "ID3") {
    start = Math.min(
      input.length,
      10 + synchsafeSize(input) + (input[5] & 0x10 ? 10 : 0),
    );
  }
  if (
    end - start >= 128 &&
    input.subarray(end - 128, end - 125).toString() === "TAG"
  ) {
    end -= 128;
  }
  const output = input.subarray(start, end);
  if (output.length < 2 || output[0] !== 0xff || (output[1] & 0xe0) !== 0xe0) {
    throw new Error("The input is not a supported MP3 file.");
  }
  return output;
}

function isPrivateIpv4(host) {
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet)))
    return false;
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

function validateRemoteUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== "https:")
    throw new Error("Direct downloads must use HTTPS.");
  const host = url.hostname.toLowerCase();
  if (
    UNSUPPORTED_DOWNLOAD_HOSTS.some(
      (blocked) => host === blocked || host.endsWith(`.${blocked}`),
    )
  ) {
    throw new Error("YouTube and Spotify downloads are not supported.");
  }
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
        /^fe[89ab]/.test(unwrappedHost) ||
        unwrappedHost.startsWith("fc") ||
        unwrappedHost.startsWith("fd") ||
        unwrappedHost.startsWith("::ffff:")))
  ) {
    throw new Error("Local and private-network download URLs are not allowed.");
  }
  return url;
}

async function fetchRemoteDownload(raw, signal) {
  let url = validateRemoteUrl(raw);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, { signal, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;
    if (redirect === MAX_REDIRECTS)
      throw new Error("The download redirected too many times.");
    const location = response.headers.get("location");
    if (!location) throw new Error("The download redirect was invalid.");
    url = validateRemoteUrl(new URL(location, url));
  }
  throw new Error("The download redirected too many times.");
}

async function readBoundedBody(response) {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_AUDIO_BYTES)
    throw new Error("The file exceeds 50 MiB.");
  if (!response.body) return Buffer.from(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_AUDIO_BYTES) {
      await reader.cancel();
      throw new Error("The file exceeds 50 MiB.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

async function download(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchRemoteDownload(url, controller.signal);
    if (!response.ok)
      throw new Error(`Download failed with HTTP ${response.status}.`);
    return readBoundedBody(response);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (Boolean(args.file) === Boolean(args["download-url"])) {
    throw new Error(
      `Provide exactly one of --file or --download-url.\n\n${usage()}`,
    );
  }
  for (const required of ["title", "artist", "duration", "source-url"]) {
    if (!args[required]?.trim())
      throw new Error(`Missing --${required}.\n\n${usage()}`);
  }
  const sourceUrl = new URL(args["source-url"]);
  if (
    sourceUrl.protocol !== "https:" ||
    !/(^|\.)suno\.com$/i.test(sourceUrl.hostname) ||
    !/^\/(song|playlist)\/[^/?#]+/i.test(sourceUrl.pathname)
  ) {
    throw new Error(
      "--source-url must be an HTTPS suno.com song or playlist URL.",
    );
  }
  const duration = Number(args.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 3600) {
    throw new Error("--duration must be an integer from 5 to 3600 seconds.");
  }

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ""
  ).trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.",
    );
  }
  const sourceBytes = args.file
    ? await readFile(resolve(args.file))
    : await download(args["download-url"]);
  if (sourceBytes.length === 0 || sourceBytes.length > MAX_AUDIO_BYTES) {
    throw new Error("The MP3 must be between 1 byte and 50 MiB.");
  }
  const audio = sanitizeMp3(sourceBytes);
  const contentSha256 = createHash("sha256").update(audio).digest("hex");
  const storagePath = `${randomUUID()}.mp3`;
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const upload = await client.storage
    .from("track-audio")
    .upload(storagePath, audio, {
      contentType: "audio/mpeg",
      cacheControl: "31536000",
      upsert: false,
    });
  if (upload.error) throw upload.error;
  try {
    const registration = await client.rpc("service_register_suno_track", {
      p_title: args.title.trim(),
      p_artist: args.artist.trim(),
      p_duration_seconds: duration,
      p_storage_path: storagePath,
      p_source_url: sourceUrl.toString(),
      p_content_sha256: contentSha256,
    });
    if (registration.error) throw registration.error;
    const track = registration.data;
    if (track.storage_path !== storagePath) {
      const cleanup = await client.storage
        .from("track-audio")
        .remove([storagePath]);
      if (cleanup.error) {
        process.stderr.write(
          `Warning: duplicate upload cleanup failed: ${cleanup.error.message}\n`,
        );
      }
    }
    process.stdout.write(
      `Imported ${track.title} by ${track.artist} (${track.track_id}).\n`,
    );
  } catch (error) {
    await client.storage.from("track-audio").remove([storagePath]);
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
