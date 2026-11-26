import { bowlingParseFrames, bowlingReadFrames, bowlingScoreRolls } from './bowling';
import { readOkey101 } from './okey101';
import { tavlaReadBoard } from './tavla';

/**
 * Oyun durumundan kazananı çıkar (turnuva otomatik sonucu, C6). Belirsizse / berabereyse null.
 * Yalnız sonucu durumdan kesin okunan oyunlar: tavla, bilardo, bowling, okey (101 cezada elenen; masada tek kişi kalınca biter).
 */
export function activityWinner(kind: string, state: Record<string, unknown>, playerIds: string[]): string | null {
  if (kind === 'tavla') {
    if (!state.board) return null;
    const b = tavlaReadBoard(state.board);
    const idx = b.off[0] >= 15 ? 0 : b.off[1] >= 15 ? 1 : -1;
    return idx >= 0 ? playerIds[idx] ?? null : null;
  }
  if (kind === 'billiards') {
    const w = state.winner;
    return typeof w === 'string' && playerIds.includes(w) ? w : null;
  }
  if (kind === 'bowling') {
    if (playerIds.length < 2) return null;
    const frames = bowlingReadFrames(state.frames);
    let best: string | null = null;
    let bestScore = -1;
    let tie = false;
    for (const id of playerIds) {
      const rolls = frames[id] ?? [];
      const fr = bowlingParseFrames(rolls);
      if (fr.length < 10 || !fr.every((f) => f.complete)) return null;
      const sc = bowlingScoreRolls(rolls);
      if (sc > bestScore) {
        best = id;
        bestScore = sc;
        tie = false;
      } else if (sc === bestScore) tie = true;
    }
    return tie ? null : best;
  }
  if (kind === 'okey') {
    if (playerIds.length < 2) return null;
    const { eliminated } = readOkey101(state);
    const left = playerIds.filter((id) => !eliminated.includes(id));
    return left.length === 1 && eliminated.length >= playerIds.length - 1 ? left[0]! : null;
  }
  return null;
}
