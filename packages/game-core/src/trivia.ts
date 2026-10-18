/** Çok oyunculu trivia — ActivitySession.state */

import { TRIVIA_BANK, triviaGenerateQuestion } from './trivia-content';

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
  /** Üretilmiş / seçilmiş soru (inline — bankaya bağımlı değil) */
  question: TriviaQuestion | null;
  usedQuestionIds: string[];
  /** userId → seçilen şık index */
  answers: Record<string, number>;
  scores: TriviaPlayerScore[];
  phase: 'lobby' | 'question' | 'reveal' | 'ended';
  revealAt?: string | null;
};

export { TRIVIA_BANK, triviaGenerateQuestion } from './trivia-content';

export function triviaEmptyState(): TriviaState {
  return {
    v: 1,
    kind: 'trivia',
    round: 0,
    questionId: null,
    question: null,
    usedQuestionIds: [],
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
  let question: TriviaQuestion | null = null;
  if (o.question && typeof o.question === 'object') {
    const q = o.question as Record<string, unknown>;
    if (
      typeof q.id === 'string' &&
      typeof q.q === 'string' &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      typeof q.correct === 'number'
    ) {
      question = {
        id: q.id,
        q: q.q,
        options: q.options as [string, string, string, string],
        correct: q.correct,
      };
    }
  }
  return {
    v: 1,
    kind: 'trivia',
    round: typeof o.round === 'number' ? o.round : 0,
    questionId: typeof o.questionId === 'string' ? o.questionId : null,
    question,
    usedQuestionIds: Array.isArray(o.usedQuestionIds)
      ? o.usedQuestionIds.filter((x): x is string => typeof x === 'string')
      : [],
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

export function triviaQuestionById(
  id: string | null,
  inline?: TriviaQuestion | null,
): TriviaQuestion | null {
  if (!id) return null;
  if (inline && inline.id === id) return inline;
  return TRIVIA_BANK.find((q) => q.id === id) ?? null;
}

/** Banka + ücretsiz prosedürel üretici */
export function triviaPickNext(usedIds: string[]): TriviaQuestion {
  return triviaGenerateQuestion(usedIds);
}

export function triviaEnsureScore(
  scores: TriviaPlayerScore[],
  userId: string,
): TriviaPlayerScore[] {
  if (scores.some((s) => s.userId === userId)) return scores;
  return [...scores, { userId, score: 0 }];
}

export function triviaCurrentQuestion(state: TriviaState): TriviaQuestion | null {
  return triviaQuestionById(state.questionId, state.question);
}
