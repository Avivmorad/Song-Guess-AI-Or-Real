export type AnswerChoice = "ai" | "real";

export type RoomPhase =
  | "lobby"
  | "preparing"
  | "countdown"
  | "playing"
  | "reveal"
  | "intermission"
  | "finished";

export type PreparationStatus = "pending" | "preparing" | "ready" | "failed";

export interface GameSettings {
  round_count: number;
  round_duration_seconds: number;
  reveal_duration_seconds: number;
  negative_points: boolean;
  allow_answer_changes: boolean;
  music_volume: number;
  song_pack: string;
}

export interface RoomPlayer {
  id: string;
  nickname: string;
  is_ready: boolean;
  is_host: boolean;
  is_connected: boolean;
  score: number;
  has_submitted: boolean;
}

export interface LeaderboardPlayer {
  id: string;
  nickname: string;
  score: number;
  is_host: boolean;
  is_me: boolean;
}

export interface ActiveRound {
  id: string;
  number: number;
  total: number;
  starts_at: string | null;
  deadline_at: string | null;
  audio_url: string | null;
  audio_available: boolean;
  audio_duration_seconds: number | null;
  preparation_status: PreparationStatus;
  preparation_error: string | null;
  audio_ready_count: number;
  audio_required_count: number;
  submitted_count: number;
  own_answer: AnswerChoice | null;
  own_points: number | null;
  correct_answer: AnswerChoice | null;
  title: string | null;
  artist: string | null;
  source_type: string | null;
  provider: "project" | "jamendo" | "suno" | null;
  source_url: string | null;
  license_url: string | null;
  genres: string[] | null;
  reveal_description: string | null;
  license_note: string | null;
}

export interface PlayedTrackResult {
  round_number: number;
  title: string;
  artist: string | null;
  answer_type: AnswerChoice;
  provider: "project" | "jamendo" | "suno";
  source_url: string | null;
  license_url: string | null;
}

export interface RoomState {
  server_now: string;
  room: {
    id: string;
    code: string;
    phase: RoomPhase;
    phase_ends_at: string | null;
    current_round: number;
    created_at: string;
    settings: GameSettings;
  };
  me: {
    id: string;
    nickname: string;
    is_host: boolean;
    is_ready: boolean;
  };
  players: RoomPlayer[];
  round: ActiveRound | null;
  round_history: PlayedTrackResult[];
  leaderboard: LeaderboardPlayer[];
}

export const DEFAULT_SETTINGS: GameSettings = {
  round_count: 6,
  round_duration_seconds: 20,
  reveal_duration_seconds: 7,
  negative_points: true,
  allow_answer_changes: false,
  music_volume: 0.8,
  song_pack: "dynamic",
};

const phases = new Set<RoomPhase>([
  "lobby",
  "preparing",
  "countdown",
  "playing",
  "reveal",
  "intermission",
  "finished",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number" && Number.isFinite(record[key]);
}

export function isRoomState(value: unknown): value is RoomState {
  if (!isRecord(value) || !isRecord(value.room) || !isRecord(value.me))
    return false;
  const room = value.room;
  const me = value.me;
  if (
    !hasString(value, "server_now") ||
    !hasString(room, "id") ||
    !hasString(room, "code") ||
    !hasString(room, "phase") ||
    !phases.has(room.phase as RoomPhase) ||
    !hasNumber(room, "current_round") ||
    !isRecord(room.settings) ||
    !hasString(me, "id") ||
    !hasString(me, "nickname") ||
    typeof me.is_host !== "boolean" ||
    typeof me.is_ready !== "boolean" ||
    !Array.isArray(value.players) ||
    !Array.isArray(value.round_history) ||
    !Array.isArray(value.leaderboard)
  ) {
    return false;
  }

  const validPlayers = value.players.every(
    (player) =>
      isRecord(player) &&
      hasString(player, "id") &&
      hasString(player, "nickname") &&
      hasNumber(player, "score") &&
      typeof player.is_ready === "boolean" &&
      typeof player.is_host === "boolean" &&
      typeof player.is_connected === "boolean" &&
      typeof player.has_submitted === "boolean",
  );
  const validHistory = value.round_history.every(
    (item) =>
      isRecord(item) &&
      hasNumber(item, "round_number") &&
      hasString(item, "title") &&
      hasString(item, "answer_type") &&
      hasString(item, "provider"),
  );
  return validPlayers && validHistory;
}

export function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-HJ-NP-Z2-9]/g, "")
    .slice(0, 6);
}

export function normalizeNickname(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 20);
}
