/** Kelime / adam asmaca tarzı — ActivitySession.state */

import { wordsPickFromBank } from './words-content';

export type WordsPlayerScore = { userId: string; score: number };

export type WordsState = {
  v: 1;
  kind: 'words';
  /** Gizli kelime */
  word: string;
  masked: string;
  guessed: string[];
  wrong: number;
  maxWrong: number;
  hostUserId: string | null;
  winnerId: string | null;
  lastGuesserId: string | null;
  scores: WordsPlayerScore[];
  usedWords: string[];
  phase: 'lobby' | 'playing' | 'won' | 'lost';
};

export { WORD_BANK, wordsPickFromBank } from './words-content';

export function wordsEmptyState(): WordsState {
  return {
    v: 1,
    kind: 'words',
    word: '',
    masked: '',
    guessed: [],
    wrong: 0,
    maxWrong: 6,
    hostUserId: null,
    winnerId: null,
    lastGuesserId: null,
    scores: [],
    usedWords: [],
    phase: 'lobby',
  };
}

export function wordsParseState(raw: unknown): WordsState {
  if (!raw || typeof raw !== 'object') return wordsEmptyState();
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'words') return wordsEmptyState();
  const phase = o.phase;
  return {
    v: 1,
    kind: 'words',
    word: typeof o.word === 'string' ? o.word : '',
    masked: typeof o.masked === 'string' ? o.masked : '',
    guessed: Array.isArray(o.guessed)
      ? o.guessed.filter((x): x is string => typeof x === 'string')
      : [],
    wrong: typeof o.wrong === 'number' ? o.wrong : 0,
    maxWrong: typeof o.maxWrong === 'number' ? o.maxWrong : 6,
    hostUserId: typeof o.hostUserId === 'string' ? o.hostUserId : null,
    winnerId: typeof o.winnerId === 'string' ? o.winnerId : null,
    lastGuesserId: typeof o.lastGuesserId === 'string' ? o.lastGuesserId : null,
    scores: Array.isArray(o.scores)
      ? (o.scores as WordsPlayerScore[]).filter(
          (s) => s && typeof s.userId === 'string' && typeof s.score === 'number',
        )
      : [],
    usedWords: Array.isArray(o.usedWords)
      ? o.usedWords.filter((x): x is string => typeof x === 'string')
      : [],
    phase:
      phase === 'playing' || phase === 'won' || phase === 'lost' || phase === 'lobby'
        ? phase
        : 'lobby',
  };
}

export function wordsPickWord(used: string[] = []): string {
  return wordsPickFromBank(used);
}

export function wordsMask(word: string, guessed: string[]): string {
  const set = new Set(guessed.map((c) => c.toLocaleLowerCase('tr-TR')));
  return word
    .split('')
    .map((ch) => (set.has(ch.toLocaleLowerCase('tr-TR')) ? ch : '_'))
    .join(' ');
}

export function wordsEnsureScore(
  scores: WordsPlayerScore[],
  userId: string,
): WordsPlayerScore[] {
  if (scores.some((s) => s.userId === userId)) return scores;
  return [...scores, { userId, score: 0 }];
}

export function wordsApplyGuess(
  state: WordsState,
  letter: string,
  userId?: string | null,
): WordsState {
  const L = letter.toLocaleLowerCase('tr-TR').slice(0, 1);
  if (!L || !/^[a-zçğıöşü]$/i.test(L)) return state;
  if (state.phase !== 'playing') return state;
  if (state.guessed.includes(L)) return state;
  const guessed = [...state.guessed, L];
  const hit = state.word.toLocaleLowerCase('tr-TR').includes(L);
  const wrong = hit ? state.wrong : state.wrong + 1;
  const masked = wordsMask(state.word, guessed);
  const won = !masked.includes('_');
  const lost = wrong >= state.maxWrong;

  let scores = state.scores;
  if (userId && hit) {
    scores = wordsEnsureScore(scores, userId).map((s) =>
      s.userId === userId ? { ...s, score: s.score + 1 } : s,
    );
  } else if (userId) {
    scores = wordsEnsureScore(scores, userId);
  }

  return {
    ...state,
    guessed,
    wrong,
    masked,
    scores,
    lastGuesserId: userId ?? state.lastGuesserId,
    winnerId: won ? userId ?? state.lastGuesserId : lost ? null : state.winnerId,
    phase: won ? 'won' : lost ? 'lost' : 'playing',
    word: state.word,
  };
}

export function wordsStart(
  hostUserId: string,
  prev?: Pick<WordsState, 'scores' | 'usedWords'>,
): WordsState {
  const usedWords = prev?.usedWords ?? [];
  const word = wordsPickWord(usedWords);
  let scores = prev?.scores ?? [];
  scores = wordsEnsureScore(scores, hostUserId);
  return {
    v: 1,
    kind: 'words',
    word,
    masked: wordsMask(word, []),
    guessed: [],
    wrong: 0,
    maxWrong: 6,
    hostUserId,
    winnerId: null,
    lastGuesserId: null,
    scores,
    usedWords: [...usedWords, word].slice(-80),
    phase: 'playing',
  };
}
