import { describe, expect, it } from "vitest";
import {
  isRoomState,
  normalizeNickname,
  normalizeRoomCode,
} from "@/lib/game/types";

describe("input normalization", () => {
  it("normalizes room codes to the unambiguous six-character alphabet", () => {
    expect(normalizeRoomCode(" abci01-2z9 ")).toBe("ABC2Z9");
  });

  it("normalizes nickname whitespace and length", () => {
    expect(normalizeNickname("  Neon   Listener  ")).toBe("Neon Listener");
    expect(normalizeNickname("x".repeat(30))).toHaveLength(20);
  });
});

describe("isRoomState", () => {
  it("rejects malformed service payloads", () => {
    expect(isRoomState(null)).toBe(false);
    expect(
      isRoomState({ room: {}, me: {}, players: [], leaderboard: [] }),
    ).toBe(false);
  });
});
