'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  wordsApplyGuess,
  wordsEnsureScore,
  wordsParseState,
  wordsStart,
  type WordsState,
} from '@dracord/game-core';
import type { GameProps } from '../three/sceneUtils';
import { ActivityScoreboard } from './ActivityScoreboard';

const LETTERS = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'.split('');

function normalizeKey(key: string): string | null {
  if (!key || key.length !== 1) return null;
  const L = key.toLocaleLowerCase('tr-TR');
  if (!/^[a-zçğıöşü]$/i.test(L)) return null;
  return L;
}

export function WordsGame({ session, userId, canPlay, onPatch, nameByUserId }: GameProps) {
  const state = useMemo(() => wordsParseState(session.state), [session.state]);
  const [busy, setBusy] = useState(false);
  const isHost = Boolean(userId && session.hostUserId === userId);

  const patch = useCallback(
    async (next: WordsState) => {
      setBusy(true);
      try {
        await onPatch(next as unknown as Record<string, unknown>);
      } finally {
        setBusy(false);
      }
    },
    [onPatch],
  );

  const start = async () => {
    if (!userId || !canPlay || !isHost) return;
    let scores = state.scores;
    for (const id of session.playerIds) scores = wordsEnsureScore(scores, id);
    await patch(wordsStart(userId, { scores, usedWords: state.usedWords }));
  };

  const guess = useCallback(
    async (letter: string) => {
      if (!canPlay || busy || state.phase !== 'playing') return;
      await patch(wordsApplyGuess(state, letter, userId));
    },
    [busy, canPlay, patch, state, userId],
  );

  useEffect(() => {
    if (state.phase !== 'playing' || !canPlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      const L = normalizeKey(e.key);
      if (!L) return;
      if (state.guessed.includes(L)) return;
      e.preventDefault();
      void guess(L);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, state.guessed, canPlay, guess]);

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
              Gizli kelimeyi harf harf bulun. Host başlatır; herkes tıklayarak veya{' '}
              <strong className="text-on-surface">klavye</strong> ile tahmin eder. Doğru harf +1
              puan.
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
            {state.phase === 'playing' && (
              <p className="text-center font-label-sm text-outline">
                Harf paneline tıkla veya klavyeden yaz
              </p>
            )}
            {state.phase === 'won' && (
              <p className="text-center font-label-md text-emerald-400">
                Bildiniz! Kelime: {state.word}
                {state.winnerId
                  ? ` · Kazanan: ${nameByUserId?.[state.winnerId] ?? 'oyuncu'}`
                  : ''}
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

        <ActivityScoreboard
          scores={state.scores}
          nameByUserId={nameByUserId}
          highlightUserId={userId}
        />
      </div>
    </div>
  );
}
