import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, generateRoomCode, normalizeNickname, normalizeRoomCode, sortLeaderboard } from '../game-core.mjs';

test('normalizes room codes and nicknames', () => {
  assert.equal(normalizeRoomCode(' ab-c12! '), 'ABC12');
  assert.equal(normalizeNickname('  Aviv   Morad  '), 'Aviv Morad');
});

test('generates six-character room codes', () => {
  assert.match(generateRoomCode(() => 0.25), /^[A-Z0-9]{6}$/);
});

test('scores correct, wrong, and missing answers', () => {
  const base = { startedAt: 1000, durationMs: 30000 };
  assert.equal(calculateScore({ ...base, correct: true, submittedAt: 1000 }), 3000);
  assert.equal(calculateScore({ ...base, correct: true, submittedAt: 31000 }), 1000);
  assert.equal(calculateScore({ ...base, correct: false, submittedAt: 2000 }), -500);
  assert.equal(calculateScore({ ...base, correct: true, submittedAt: Number.NaN }), 0);
});

test('sorts leaderboard by score then name', () => {
  assert.deepEqual(sortLeaderboard([
    { name: 'Zed', score: 10 },
    { name: 'Ari', score: 10 },
    { name: 'Kim', score: 20 }
  ]).map((p) => p.name), ['Kim', 'Ari', 'Zed']);
});
