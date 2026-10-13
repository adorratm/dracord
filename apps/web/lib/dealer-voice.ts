/**
 * Blackjack kurpiyer sesi — Microsoft Azure Emel Neural (tr-TR-EmelNeural).
 * Öncelik: sunucu Emel TTS → tarayıcıda Emel Web Speech → diğer TR ses.
 */

const STORAGE_MUTE = 'dracord.dealerVoice.muted';
const STORAGE_VOL = 'dracord.dealerVoice.volume';

let muted = false;
let volume = 0.85;
let speaking = false;
let onSpeakingChange: ((v: boolean) => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;
let speakToken = 0;
let voicesReady: Promise<void> | null = null;

const audioCache = new Map<string, string>();

function loadPrefs() {
  if (typeof window === 'undefined') return;
  try {
    const m = localStorage.getItem(STORAGE_MUTE);
    if (m === '1' || m === 'true') muted = true;
    if (m === '0' || m === 'false') muted = false;
    const v = Number(localStorage.getItem(STORAGE_VOL));
    if (Number.isFinite(v)) volume = Math.min(1, Math.max(0, v));
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined') loadPrefs();

export function isDealerVoiceMuted() {
  return muted;
}

export function getDealerVoiceVolume() {
  return volume;
}

export function setDealerVoiceMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(STORAGE_MUTE, next ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (next) stopDealerSpeech();
}

/** 0–1 */
export function setDealerVoiceVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));
  try {
    localStorage.setItem(STORAGE_VOL, String(volume));
  } catch {
    /* ignore */
  }
  if (currentAudio) currentAudio.volume = volume;
  if (volume <= 0.001) stopDealerSpeech();
}

export function onDealerSpeakingChange(cb: ((v: boolean) => void) | null) {
  onSpeakingChange = cb;
}

function setSpeaking(v: boolean) {
  speaking = v;
  onSpeakingChange?.(v);
}

export function isDealerSpeaking() {
  return speaking;
}

export function prepareDealerText(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  t = t
    .replace(/\bBlackjack\b/gi, 'blackjack')
    .replace(/\bDouble\b/gi, 'çift')
    .replace(/\bBust\b/gi, 'battı')
    .replace(/\bPush\b/gi, 'berabere')
    .replace(/'(\w)/g, ' $1')
    .replace(/\s*[—–-]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > 70 && !t.includes(',')) {
    const mid = t.search(/\s+(ve|ama|çünkü|şimdi|hadı|hadi)\s+/i);
    if (mid > 20) {
      t = `${t.slice(0, mid).trim()}, ${t.slice(mid).trim()}`;
    }
  }
  if (!/[.!?…]$/.test(t)) t += '.';
  return t;
}

/** Yalnızca Microsoft Emel (Azure / Online Natural) */
function pickEmelVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    if (!/emel/i.test(v.name)) continue;
    let s = 10;
    if (/microsoft/i.test(v.name)) s += 50;
    if (/online|natural|neural/i.test(v.name)) s += 40;
    if (/^tr(-|_|$)/i.test(v.lang)) s += 20;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

/** Son çare: herhangi bir TR kadın sesi */
function pickFallbackVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const name = v.name;
    const lang = v.lang;
    if (!/tr/i.test(lang) && !/turkish|türk/i.test(name)) continue;
    let s = /^tr(-|_|$)/i.test(lang) ? 40 : 10;
    if (/microsoft/i.test(name)) s += 30;
    if (/(ahmet|male|man|erkek|tolga)/i.test(name)) s -= 80;
    if (/female|kadın|aylin|filiz|yelda/i.test(name)) s += 20;
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

function ensureVoices(): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve();
  }
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    window.setTimeout(done, 800);
  });
  return voicesReady;
}

export function warmDealerVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  void ensureVoices();
  window.speechSynthesis.getVoices();
}

function ttsProxyUrl(text: string): string {
  return `/api/dealer-tts?q=${encodeURIComponent(text)}`;
}

function stopAudio() {
  if (currentAudio) {
    try {
      currentAudio.onended = null;
      currentAudio.onerror = null;
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
    } catch {
      /* ignore */
    }
    currentAudio = null;
  }
}

export function stopDealerSpeech() {
  speakToken += 1;
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  stopAudio();
  setSpeaking(false);
}

function speakWebSpeech(
  text: string,
  voice: SpeechSynthesisVoice,
  rate?: number,
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice.lang || 'tr-TR';
  u.voice = voice;
  const isEmel = /emel/i.test(voice.name);
  const isNatural = /natural|neural|online/i.test(voice.name);
  u.rate = rate ?? (isEmel || isNatural ? 1.02 : 1.0);
  u.pitch = isEmel || isNatural ? 1.02 : 1.06;
  u.volume = volume;
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  setSpeaking(true);
  window.setTimeout(() => {
    if (muted) return;
    try {
      window.speechSynthesis.speak(u);
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch {
      setSpeaking(false);
    }
  }, 60);
  return true;
}

/** Microsoft Azure Emel Neural (sunucu proxy) */
async function playEmelNeural(text: string, token: number): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  let src = audioCache.get(text);
  if (!src) {
    try {
      const res = await fetch(ttsProxyUrl(text), {
        credentials: 'same-origin',
        cache: 'force-cache',
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      if (!blob.size || (blob.type && blob.type.includes('json'))) return false;
      src = URL.createObjectURL(blob);
      audioCache.set(text, src);
      if (audioCache.size > 48) {
        const first = audioCache.keys().next().value;
        if (first) {
          const old = audioCache.get(first);
          if (old) URL.revokeObjectURL(old);
          audioCache.delete(first);
        }
      }
    } catch {
      return false;
    }
  }
  if (token !== speakToken) return false;

  return await new Promise<boolean>((resolve) => {
    stopAudio();
    const audio = new Audio();
    currentAudio = audio;
    audio.preload = 'auto';
    audio.volume = volume;
    // Emel Neural zaten doğal tempo
    audio.playbackRate = 1;
    try {
      (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    } catch {
      /* ignore */
    }
    audio.src = src!;
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      if (currentAudio === audio) currentAudio = null;
      resolve(ok);
    };
    audio.onended = () => done(true);
    audio.onerror = () => done(false);
    setSpeaking(true);
    void audio.play().then(
      () => undefined,
      () => done(false),
    );
    window.setTimeout(() => {
      if (!settled && audio.paused && audio.currentTime === 0) done(false);
    }, 8000);
  });
}

export function speakDealer(text: string, opts?: { interrupt?: boolean; rate?: number }) {
  if (muted || typeof window === 'undefined') return;
  const prepared = prepareDealerText(text);
  if (!prepared) return;

  if (opts?.interrupt !== false) {
    speakToken += 1;
    window.speechSynthesis?.cancel();
    stopAudio();
  }

  const token = speakToken;

  void (async () => {
    await ensureVoices();
    if (token !== speakToken || muted) return;

    // 1) Microsoft Azure Emel Neural (sunucu)
    setSpeaking(true);
    const ok = await playEmelNeural(prepared, token);
    if (token !== speakToken) return;
    if (ok) {
      setSpeaking(false);
      return;
    }

    // 2) Tarayıcıda Emel Web Speech
    const emel = pickEmelVoice();
    if (emel && speakWebSpeech(prepared, emel, opts?.rate)) return;

    // 3) Son çare: diğer TR ses
    const fallback = pickFallbackVoice();
    if (fallback && speakWebSpeech(prepared, fallback, opts?.rate)) return;

    setSpeaking(false);
  })();
}
