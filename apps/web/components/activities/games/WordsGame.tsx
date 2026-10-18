'use client';

import { useMemo, useState } from 'react';
import {
  wordsApplyGuess,
  wordsParseState,
  wordsStart,
  type WordsState,
} from '@dracord/game-core';
import type { GameProps } from '../three/sceneUtils';

const LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

export function WordsGame({ session, userId, canPlay, onPatch, nameByUserId }: GameProps) {
  const state = useMemo(() => wordsParseState(session.state), [session.state]);
  const [busy, setBusy] = useState(false);
  const isHost = Boolean(userId && session.hostUserId === userId);

  const patch = async (next: WordsState) => {
    setBusy(true);
    try {
      await onPatch(next as unknown as Record<string, unknown>);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    if (!userId || !canPlay || !isHost) return;
    await patch(wordsStart(userId));
  };

  const guess = async (letter: string) => {
    if (!canPlay || state.phase !== 'playing') return;
    await patch(wordsApplyGuess(state, letter));
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 p-6 bg-gradient-to-b from-[#142014] to-[#11131e]">
      <div className="w-full max-w-lg rounded-2xl border border-lime-500/30 bg-[#11131e]/95 p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-headline-lg text-on-surface">Kelime</h2>
          <span className="font-label-sm text-outline">
            Hata {state.wrong}/{state.maxWrong}
          </span>
        </div>

        {state.phase === 'lobby' && (
          <div className="space-y-3">
            <p className="font-body-sm text-on-surface-variant">
              Gizli kelimeyi harf harf bulun. Host oyunu başlatır; herkes tahmin edebilir.
            </p>
            {isHost ? (
              <button
                type="button"
                disabled={busy || !canPlay}
                onClick={() => void start()}
                className="h-10 w-full rounded-xl bg-lime-500 font-label-md text-[#11131e] disabled:opacity-40"
              >
                Kelimeyi seç ve başla
              </button>
            ) : (
              <p className="font-label-sm text-outline">Host’un başlamasını bekle…</p>
            )}
          </div>
        )}

        {state.phase !== 'lobby' && (
          <div className="space-y-4">
            <p className="text-center font-mono text-2xl tracking-[0.35em] text-on-surface">
              {state.masked || '—'}
            </p>
            {state.phase === 'won' && (
              <p className="text-center font-label-md text-emerald-400">
                Bildiniz! Kelime: {state.word}
              </p>
            )}
            {state.phase === 'lost' && (
              <p className="text-center font-label-md text-rose-400">
                Bitemedi — kelime: {state.word}
              </p>
            )}
            {state.phase === 'playing' && (
              <div className="flex flex-wrap justify-center gap-1.5">
                {LETTERS.map((L) => {
                  const low = L.toLocaleLowerCase('tr-TR');
                  const used = state.guessed.includes(low);
                  return (
                    <button
                      key={L}
                      type="button"
                      disabled={busy || !canPlay || used}
                      onClick={() => void guess(L)}
                      className="h-9 w-9 rounded-lg bg-surface-container-high font-label-md text-on-surface disabled:opacity-30 hover:bg-surface-bright"
                    >
                      {L}
                    </button>
                  );
                })}
              </div>
            )}
            {(state.phase === 'won' || state.phase === 'lost') && isHost && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void start()}
                className="h-9 w-full rounded-lg bg-lime-500 font-label-sm text-[#11131e]"
              >
                Yeni kelime
              </button>
            )}
            {state.hostUserId && (
              <p className="text-center font-label-sm text-outline">
                Host: {nameByUserId?.[state.hostUserId] ?? '—'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
