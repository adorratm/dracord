/** Çok oyunculu trivia — ActivitySession.state */

export type TriviaQuestion = {
  id: string;
  q: string;
  options: [string, string, string, string];
  /** 0–3 */
  correct: number;
};

export type TriviaPlayerScore = { userId: string; score: number };

export type TriviaState = {
  v: 1;
  kind: 'trivia';
  round: number;
  questionId: string | null;
  /** userId → seçilen şık index */
  answers: Record<string, number>;
  scores: TriviaPlayerScore[];
  phase: 'lobby' | 'question' | 'reveal' | 'ended';
  revealAt?: string | null;
};

export const TRIVIA_BANK: TriviaQuestion[] = [
  {
    id: 't1',
    q: 'Türkiye’nin başkenti neresidir?',
    options: ['İstanbul', 'Ankara', 'İzmir', 'Bursa'],
    correct: 1,
  },
  {
    id: 't2',
    q: 'HTML’de sayfa başlığı hangi etiketle yazılır?',
    options: ['<head>', '<title>', '<header>', '<h1>'],
    correct: 1,
  },
  {
    id: 't3',
    q: 'Bir yılda kaç ay vardır?',
    options: ['10', '11', '12', '13'],
    correct: 2,
  },
  {
    id: 't4',
    q: '“NaCl” hangi bileşiğin formülüdür?',
    options: ['Şeker', 'Sofra tuzu', 'Karbonat', 'Sirke'],
    correct: 1,
  },
  {
    id: 't5',
    q: 'Futbolda bir takım kaç oyuncuyla sahada başlar?',
    options: ['9', '10', '11', '12'],
    correct: 2,
  },
  {
    id: 't6',
    q: 'JavaScript’te dizi uzunluğu hangi özelliktedir?',
    options: ['size', 'count', 'length', 'len'],
    correct: 2,
  },
  {
    id: 't7',
    q: 'Ay’ın Dünya etrafındaki turuna ne denir?',
    options: ['Rotasyon', 'Revölüsyon', 'Translasyon', 'Orbitasyon'],
    correct: 1,
  },
  {
    id: 't8',
    q: '“Mona Lisa” hangi sanatçıya aittir?',
    options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Rembrandt'],
    correct: 2,
  },
  {
    id: 't9',
    q: 'HTTP’de başarılı yanıt kodu hangisidir?',
    options: ['301', '404', '500', '200'],
    correct: 3,
  },
  {
    id: 't10',
    q: 'En büyük okyanus hangisidir?',
    options: ['Atlas', 'Hint', 'Pasifik', 'Arktik'],
    correct: 2,
  },
];

export function triviaEmptyState(): TriviaState {
  return {
    v: 1,
    kind: 'trivia',
    round: 0,
    questionId: null,
    answers: {},
    scores: [],
    phase: 'lobby',
    revealAt: null,
  };
}

export function triviaParseState(raw: unknown): TriviaState {
  if (!raw || typeof raw !== 'object') return triviaEmptyState();
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'trivia') return triviaEmptyState();
  const phase = o.phase;
  return {
    v: 1,
    kind: 'trivia',
    round: typeof o.round === 'number' ? o.round : 0,
    questionId: typeof o.questionId === 'string' ? o.questionId : null,
    answers:
      o.answers && typeof o.answers === 'object'
        ? (o.answers as Record<string, number>)
        : {},
    scores: Array.isArray(o.scores)
      ? (o.scores as TriviaPlayerScore[]).filter(
          (s) => s && typeof s.userId === 'string' && typeof s.score === 'number',
        )
      : [],
    phase:
      phase === 'question' || phase === 'reveal' || phase === 'ended' || phase === 'lobby'
        ? phase
        : 'lobby',
    revealAt: typeof o.revealAt === 'string' ? o.revealAt : null,
  };
}

export function triviaQuestionById(id: string | null): TriviaQuestion | null {
  if (!id) return null;
  return TRIVIA_BANK.find((q) => q.id === id) ?? null;
}

export function triviaPickNext(usedIds: string[]): TriviaQuestion {
  const pool = TRIVIA_BANK.filter((q) => !usedIds.includes(q.id));
  const list = pool.length ? pool : TRIVIA_BANK;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function triviaEnsureScore(
  scores: TriviaPlayerScore[],
  userId: string,
): TriviaPlayerScore[] {
  if (scores.some((s) => s.userId === userId)) return scores;
  return [...scores, { userId, score: 0 }];
}
