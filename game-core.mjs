export const MAX_PLAYERS = 12;
export const DEFAULT_SETTINGS = Object.freeze({ rounds: 6, roundSeconds: 30, revealSeconds: 6 });

export function normalizeNickname(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, 24);
}

export function normalizeRoomCode(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

export function createToken() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function generateRoomCode(random = Math.random) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(random() * alphabet.length)];
  return code;
}

export function calculateScore({ correct, submittedAt, startedAt, durationMs }) {
  if (!Number.isFinite(submittedAt)) return 0;
  if (!correct) return -500;
  const elapsed = Math.max(0, submittedAt - startedAt);
  const remainingRatio = Math.max(0, Math.min(1, 1 - elapsed / durationMs));
  return 1000 + Math.floor(2000 * remainingRatio);
}

export function sortLeaderboard(players) {
  return [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
