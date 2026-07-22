import { describe, expect, it } from "vitest";
import { getRemainingMs, getStartGate } from "@/lib/game/room-rules";
import type { RoomPlayer } from "@/lib/game/types";

function player(overrides: Partial<RoomPlayer> = {}): RoomPlayer {
  return {
    id: crypto.randomUUID(),
    nickname: "Player",
    is_ready: true,
    is_host: false,
    is_connected: true,
    score: 0,
    has_submitted: false,
    ...overrides,
  };
}

describe("getStartGate", () => {
  it("requires at least two players", () => {
    expect(getStartGate([player()])).toEqual({
      canStart: false,
      reason: "At least two players are required.",
    });
  });

  it("blocks disconnected and unready players", () => {
    expect(
      getStartGate([player(), player({ is_connected: false })]).reason,
    ).toBe("Wait for disconnected players to return.");
    expect(getStartGate([player(), player({ is_ready: false })]).reason).toBe(
      "Every player must be ready.",
    );
  });

  it("opens only when everyone is connected and ready", () => {
    expect(getStartGate([player(), player()])).toEqual({
      canStart: true,
      reason: "Everyone is ready.",
    });
  });
});

describe("getRemainingMs", () => {
  it("uses the measured server offset and never returns a negative value", () => {
    const realNow = Date.now;
    Date.now = () => 1_000;
    try {
      expect(getRemainingMs(new Date(2_500).toISOString(), 500)).toBe(1_000);
      expect(getRemainingMs(new Date(500).toISOString())).toBe(0);
      expect(getRemainingMs(null)).toBe(0);
    } finally {
      Date.now = realNow;
    }
  });
});
