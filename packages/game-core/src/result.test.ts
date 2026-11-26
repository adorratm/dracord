import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityWinner } from './result';

test('okey: the last player standing wins the table', () => {
  const players = ['a', 'b', 'c', 'd'];
  const state = (elim: string[]) => ({ hands: { _elim: elim, _ind: [3] }, scores: {} });
  assert.equal(activityWinner('okey', state([]), players), null);
  assert.equal(activityWinner('okey', state(['b', 'c']), players), null);
  assert.equal(activityWinner('okey', state(['b', 'c', 'd']), players), 'a');
});

test('unknown games have no automatic winner', () => {
  assert.equal(activityWinner('words', {}, ['a', 'b']), null);
});
