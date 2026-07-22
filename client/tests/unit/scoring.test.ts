import { describe, expect, it } from "vitest";
import { calculateScore, formatScore } from "@/lib/game/scoring";

const startsAtMs = 1_000;
const deadlineAtMs = 11_000;

describe("calculateScore", () => {
  it("awards the full 3,000 points at the start", () => {
    expect(
      calculateScore({
        isCorrect: true,
        submittedAtMs: startsAtMs,
        startsAtMs,
        deadlineAtMs,
        negativePoints: true,
      }),
    ).toEqual({ base: 1000, speed: 2000, penalty: 0, total: 3000 });
  });

  it("decreases speed points smoothly over the answer window", () => {
    expect(
      calculateScore({
        isCorrect: true,
        submittedAtMs: 6_000,
        startsAtMs,
        deadlineAtMs,
        negativePoints: true,
      }),
    ).toEqual({ base: 1000, speed: 1000, penalty: 0, total: 2000 });
  });

  it("clamps correct answers to the valid scoring window", () => {
    const early = calculateScore({
      isCorrect: true,
      submittedAtMs: 0,
      startsAtMs,
      deadlineAtMs,
      negativePoints: true,
    });
    const late = calculateScore({
      isCorrect: true,
      submittedAtMs: 50_000,
      startsAtMs,
      deadlineAtMs,
      negativePoints: true,
    });

    expect(early.total).toBe(3000);
    expect(late.total).toBe(1000);
  });

  it("applies or disables the wrong-answer penalty", () => {
    const penalized = calculateScore({
      isCorrect: false,
      submittedAtMs: 5_000,
      startsAtMs,
      deadlineAtMs,
      negativePoints: true,
    });
    const neutral = calculateScore({
      isCorrect: false,
      submittedAtMs: 5_000,
      startsAtMs,
      deadlineAtMs,
      negativePoints: false,
    });

    expect(penalized.total).toBe(-500);
    expect(neutral.total).toBe(0);
  });

  it("awards zero when no answer was submitted", () => {
    expect(
      calculateScore({
        isCorrect: false,
        submittedAtMs: null,
        startsAtMs,
        deadlineAtMs,
        negativePoints: true,
      }),
    ).toEqual({ base: 0, speed: 0, penalty: 0, total: 0 });
  });
});

describe("formatScore", () => {
  it("uses readable thousands separators", () => {
    expect(formatScore(12_345)).toBe("12,345");
  });
});
