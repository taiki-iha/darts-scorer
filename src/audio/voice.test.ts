import { expect, test } from 'vitest';
import { ANNOUNCE } from './voice';

test('announcer lines', () => {
  expect(ANNOUNCE.TON80).toBe('Ton eighty!');
  expect(ANNOUNCE.HAT_TRICK).toBe('Hat trick!');
  expect(ANNOUNCE.WHITE_HORSE).toBe('White horse!');
  expect(ANNOUNCE.NINE_MARKS).toBe('Nine marks!');
  expect(ANNOUNCE.BUST).toBe('Bust!');
  expect(ANNOUNCE.GAME_SHOT).toBe('Game shot!');
  expect(ANNOUNCE.WIN).toBe('Winner!');
  expect(ANNOUNCE.BULL).toBeUndefined();
});
