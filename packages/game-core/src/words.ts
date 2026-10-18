/** Kelime / adam asmaca tarzı — ActivitySession.state */

export type WordsState = {
  v: 1;
  kind: 'words';
  /** Gizli kelime — yalnızca host doğrular; istemciler masked görür */
  word: string;
  masked: string;
  guessed: string[];
  wrong: number;
  maxWrong: number;
  hostUserId: string | null;
  winnerId: string | null;
  phase: 'lobby' | 'playing' | 'won' | 'lost';
};

const WORD_BANK = [
  'dracord',
  'sunucu',
  'mikrofon',
  'klavye',
  'bilardo',
  'tavla',
  'müzik',
  'arkadaş',
  'kanal',
  'roket',
  'uzay',
  'kahve',
  'istanbul',
  'ankara',
  'yazılım',
  'oyun',
];

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
    phase:
      phase === 'playing' || phase === 'won' || phase === 'lost' || phase === 'lobby'
        ? phase
        : 'lobby',
  };
}

export function wordsPickWord(): string {
  return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)]!;
}

export function wordsMask(word: string, guessed: string[]): string {
  const set = new Set(guessed.map((c) => c.toLocaleLowerCase('tr-TR')));
  return word
    .split('')
    .map((ch) => (set.has(ch.toLocaleLowerCase('tr-TR')) ? ch : '_'))
    .join(' ');
}

export function wordsApplyGuess(state: WordsState, letter: string): WordsState {
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
  return {
    ...state,
    guessed,
    wrong,
    masked,
    phase: won ? 'won' : lost ? 'lost' : 'playing',
    // kelimeyi kaybetmede aç
    word: won || lost ? state.word : state.word,
  };
}

export function wordsStart(hostUserId: string): WordsState {
  const word = wordsPickWord();
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
    phase: 'playing',
  };
}
