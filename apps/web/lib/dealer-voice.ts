/**
 * Blackjack kurpiyer sesi.
 * 1) Google Translate TTS (doğal tr-TR) — kısa cümleler
 * 2) Web Speech — nöral/Online ses skorlaması ile yedek
 */

const STORAGE_MUTE = 'dracord.dealerVoice.muted';
const STORAGE_VOL = 'dracord.dealerVoice.volume';

let muted = false;
let volume = 0.85;
let speaking = false;
let onSpeakingChange: ((v: boolean) => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;
let speakToken = 0;

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

/** Konuşma metnini TTS için yumuşat */
export function prepareDealerText(raw: string): string {
  let t = raw.trim();
  if (!t) return '';
  // İngilizce / oyun jargonunu Türkçe okunuşa çek
  t = t
    .replace(/\bBlackjack\b/gi, 'blackjack')
    .replace(/\bDouble\b/gi, 'çift')
    .replace(/\bBust\b/gi, 'battı')
    .replace(/\bPush\b/gi, 'berabere')
    .replace(/'(\w)/g, ' $1'); // Ali'de → Ali de (daha net)
  // Çok hızlı okunan ekleri ayır
  t = t.replace(/\s+/g, ' ').trim();
  if (!/[.!?…]$/.test(t)) t += '.';
  return t;
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name;
  const lang = v.lang;
  if (/^tr(-|_|$)/i.test(lang)) s += 100;
  else if (/tr/i.test(lang)) s += 40;
  else return -1;

  // Nöral / online sesler çok daha iyi
  if (/online|natural|neural|premium|enhanced/i.test(name)) s += 80;
  if (/google/i.test(name)) s += 50;
  if (/microsoft/i.test(name)) s += 45;
  // Kadın ses isimleri (TR + genel)
  if (
    /(emel|aylin|filiz|yelda|zira|female|woman|kız|kadin|kadın|eva|seda|deniz)/i.test(
      name,
    )
  ) {
    s += 35;
  }
  // Erkek sesleri biraz düşür
  if (/(ahmet|male|man|erkek|tolga)/i.test(name)) s -= 25;
  if (v.localService) s -= 5; // online genelde daha iyi
  return s;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const sc = scoreVoice(v);
    if (sc > bestScore) {
      bestScore = sc;
      best = v;
    }
  }
  return best;
}

export function warmDealerVoices() {
  if (typeof window === 'undefined') return;
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
  // Prefetch kısa bir sessiz istek yok — ilk cümlede cache dolar
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

function speakWebSpeech(text: string, rate?: number): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'tr-TR';
  // Türkçe için biraz yavaş + yumuşak perde
  u.rate = rate ?? 0.92;
  u.pitch = 1.08;
  u.volume = volume;
  const voice = pickVoice();
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang || 'tr-TR';
  }
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  setSpeaking(true);
  window.speechSynthesis.speak(u);
  return true;
}

async function playNeuralAudio(text: string, token: number): Promise<boolean> {
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
    }, 5000);
  });
}

/**
 * Uzun metni Google TTS limitine (~180) göre böl.
 */
function chunkText(text: string, max = 160): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < 40) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
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
  const chunks = chunkText(prepared);

  void (async () => {
    setSpeaking(true);
    for (const chunk of chunks) {
      if (token !== speakToken) return;
      const ok = await playNeuralAudio(chunk, token);
      if (token !== speakToken) return;
      if (!ok) {
        // Yedek: Web Speech (nöral ses varsa hâlâ kabul edilebilir)
        speakWebSpeech(chunks.join(' '), opts?.rate);
        return;
      }
    }
    if (token === speakToken) setSpeaking(false);
  })();
}
