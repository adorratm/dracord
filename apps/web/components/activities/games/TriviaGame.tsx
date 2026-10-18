'use client';

import { useMemo, useState } from 'react';
import {
  triviaCurrentQuestion,
  triviaEnsureScore,
  triviaParseState,
  triviaPickNext,
  type TriviaState,
} from '@dracord/game-core';
import type { GameProps } from '../three/sceneUtils';
import { ActivityScoreboard } from './ActivityScoreboard';

export function TriviaGame({ session, userId, canPlay, onPatch, nameByUserId }: GameProps) {
  const state = useMemo(() => triviaParseState(session.state), [session.state]);
  const [busy, setBusy] = useState(false);
  const q = triviaCurrentQuestion(state);
  const myAnswer = userId ? state.answers[userId] : undefined;
  const isHost = Boolean(userId && session.hostUserId === userId);

  const patch = async (next: TriviaState) => {
    setBusy(true);
    try {
      await onPatch(next as unknown as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  };

  const startRound = async () => {
    if (!canPlay || !isHost) return;
    const used = state.usedQuestionIds.length
      ? state.usedQuestionIds
      : state.questionId
        ? [state.questionId]
        : [];
    const nextQ = triviaPickNext(used);
    let scores = state.scores;
    for (const id of session.playerIds) scores = triviaEnsureScore(scores, id);
    await patch({
      ...state,
      round: state.round + 1,
      questionId: nextQ.id,
      question: nextQ,
      usedQuestionIds: [...used, nextQ.id].slice(-120),
      answers: {},
      scores,
      phase: 'question',
      revealAt: null,
    });
  };

  const answer = async (idx: number) => {
    if (!canPlay || !userId || state.phase !== 'question' || myAnswer != null) return;
    const answers = { ...state.answers, [userId]: idx };
    await patch({ ...state, answers });
  };

  const reveal = async () => {
    if (!canPlay || !isHost || !q) return;
    let scores = [...state.scores];
    for (const [uid, ans] of Object.entries(state.answers)) {
      if (ans === q.correct) {
        scores = triviaEnsureScore(scores, uid).map((s) =>
          s.userId === uid ? { ...s, score: s.score + 1 } : s,
        );
      }
    }
    await patch({
      ...state,
      scores,
      phase: 'reveal',
      revealAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6 bg-gradient-to-b from-[#1a1025] to-[#11131e]">
      <div className="w-full max-w-lg rounded-2xl border border-[#bd93f9]/30 bg-[#11131e]/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-headline-lg text-on-surface">Trivia</h2>
          <span className="font-label-sm text-outline">Tur {state.round}</span>
        </div>

        {state.phase === 'lobby' && (
          <div className="space-y-3">
            <p className="font-body-sm text-on-surface-variant">
              Bilgi yarışması — sorular yerel banka + ücretsiz üreticiden gelir (API anahtarı
              yok). Host soruyu açar, doğru cevap +1 puan.
            </p>
            {isHost ? (
              <button
                type="button"
                disabled={busy || !canPlay}
                onClick={() => void startRound()}
                className="h-10 w-full rounded-xl bg-[#bd93f9] font-label-md text-[#11131e] disabled:opacity-40"
              >
                İlk soruyu başlat
              </button>
            ) : (
              <p className="font-label-sm text-outline">Host’un başlamasını bekle…</p>
            )}
          </div>
        )}

        {(state.phase === 'question' || state.phase === 'reveal') && q && (
          <div className="space-y-3">
            <p className="font-headline-md text-on-surface">{q.q}</p>
            <div className="grid gap-2">
              {q.options.map((opt, i) => {
                const selected = myAnswer === i;
                const showCorrect = state.phase === 'reveal' && i === q.correct;
                const showWrong =
                  state.phase === 'reveal' && selected && i !== q.correct;
                return (
                  <button
                    key={`${q.id}-${i}`}
                    type="button"
                    disabled={busy || !canPlay || state.phase !== 'question' || myAnswer != null}
                    onClick={() => void answer(i)}
                    className={`min-h-11 rounded-xl px-3 text-left font-label-md transition-colors disabled:opacity-70 ${
                      showCorrect
                        ? 'bg-emerald-600/80 text-white'
                        : showWrong
                          ? 'bg-rose-700/70 text-white'
                          : selected
                            ? 'bg-[#bd93f9]/40 text-on-surface ring-1 ring-[#bd93f9]'
                            : 'bg-surface-container-high text-on-surface hover:bg-surface-bright'
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                );
              })}
            </div>
            {state.phase === 'question' && isHost && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void reveal()}
                className="h-9 w-full rounded-lg bg-surface-container-highest font-label-sm text-on-surface"
              >
                Cevapları açıkla
              </button>
            )}
            {state.phase === 'reveal' && isHost && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startRound()}
                className="h-9 w-full rounded-lg bg-[#bd93f9] font-label-sm text-[#11131e]"
              >
                Sonraki soru
              </button>
            )}
          </div>
        )}

        <ActivityScoreboard
          scores={state.scores}
          nameByUserId={nameByUserId}
          highlightUserId={userId}
        />
      </div>
    </div>
  );
}
