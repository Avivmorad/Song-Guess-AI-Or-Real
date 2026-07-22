import type { RoomPlayer } from "./types";

export interface StartGate {
  canStart: boolean;
  reason: string;
}

export function getStartGate(players: RoomPlayer[]): StartGate {
  if (players.length < 2) {
    return { canStart: false, reason: "At least two players are required." };
  }
  if (players.some((player) => !player.is_connected)) {
    return { canStart: false, reason: "Wait for disconnected players to return." };
  }
  if (players.some((player) => !player.is_ready)) {
    return { canStart: false, reason: "Every player must be ready." };
  }
  return { canStart: true, reason: "Everyone is ready." };
}

export function getRemainingMs(endsAt: string | null, serverOffsetMs = 0): number {
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - (Date.now() + serverOffsetMs));
}
