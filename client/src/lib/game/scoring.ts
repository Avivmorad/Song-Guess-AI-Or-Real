export interface ScoreInput {
  isCorrect: boolean;
  submittedAtMs: number | null;
  startsAtMs: number;
  deadlineAtMs: number;
  negativePoints: boolean;
}

export interface ScoreResult {
  base: number;
  speed: number;
  penalty: number;
  total: number;
}

export function calculateScore(input: ScoreInput): ScoreResult {
  if (input.submittedAtMs === null) {
    return { base: 0, speed: 0, penalty: 0, total: 0 };
  }

  if (!input.isCorrect) {
    const penalty = input.negativePoints ? -500 : 0;
    return { base: 0, speed: 0, penalty, total: penalty };
  }

  const duration = Math.max(1, input.deadlineAtMs - input.startsAtMs);
  const elapsed = Math.max(0, Math.min(duration, input.submittedAtMs - input.startsAtMs));
  const speed = Math.max(0, Math.round(2000 * (1 - elapsed / duration)));
  return { base: 1000, speed, penalty: 0, total: 1000 + speed };
}

export function formatScore(score: number): string {
  return new Intl.NumberFormat("en-US").format(score);
}
