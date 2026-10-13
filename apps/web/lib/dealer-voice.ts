/**
 * Blackjack kurpiyer sesi — Microsoft Türkçe kadın sesi (Web Speech) öncelikli.
 * Emel Online / Natural tercih edilir; Google TTS yedek.
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
    // Doğal nefes / vurgu için kısa duraklar
    .replace(/\s*[—–-]\s*/g, ', ')
    .replace(/\s*;\s*/g, ', ');
  t = t.replace(/\s+/g, ' ').trim();
  // Çok uzun cümleleri virgülle böl — TTS daha akıcı okur
  if (t.length > 70 && !t.includes(',')) {
    const mid = t.search(/\s+(ve|ama|çünkü|şimdi|hadı|hadi)\s+/i);
    if (mid > 20) {
      t = `${t.slice(0, mid).trim()}, ${t.slice(mid).trim()}`;
    }
  }
  if (!/[.!?…]$/.test(t)) t += '.';
  return t;
}

/** Microsoft Emel / Natural kadın seslerini en üste koy */
function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name;
  const lang = v.lang;
  if (!/tr/i.test(lang) && !/turkish|türk/i.test(name)) return -1;
  if (/^tr(-|_|$)/i.test(lang)) s += 100;
  else s += 50;

  // Microsoft Natural / Online Neural — en gerçekçi
  if (/microsoft/i.test(name)) s += 130;
  if (/emel/i.test(name)) s += 110;
  if (/online\s*\(natural\)|natural online|neural/i.test(name)) s += 100;
  else if (/online|natural/i.test(name)) s += 85;
  if (/desktop/i.test(name)) s -= 25; // Desktop eski sesler daha robotik
  if (/female|woman|kız|kadın|aylin|filiz|yelda|zira|seda/i.test(name)) s += 45;
  if (/google/i.test(name)) s += 15;
  if (/(ahmet|male|man|erkek|tolga)/i.test(name)) s -= 80;
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
    // Bazı tarayıcılarda event gelmez
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

function speakWebSpeech(text: string, rate?: number): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  const voice = pickVoice();
  if (!voice) return false;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice.lang || 'tr-TR';
  u.voice = voice;
  const isMs = /microsoft/i.test(voice.name);
  const isNatural = /natural|neural|online/i.test(voice.name);
  const isEmel = /emel/i.test(voice.name);
  // Doğal tempo: çok hızlı robotik, çok yavaş sıkıcı — ~1.0–1.05
  u.rate = rate ?? (isEmel || isNatural ? 1.02 : isMs ? 1.04 : 1.0);
  u.pitch = isEmel || isNatural ? 1.02 : isMs ? 1.04 : 1.08;
  u.volume = volume;
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  setSpeaking(true);
  // Kısa gecikme — ses motorunun cancel sonrası takılmasını azaltır
  window.setTimeout(() => {
    if (muted) return;
    try {
      window.speechSynthesis.speak(u);
      // Chrome bazen paused kalır
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    } catch {
      setSpeaking(false);
    }
  }, 60);
  return true;
}

async function playGoogleFallback(text: string, token: number): Promise<boolean> {
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
    // Google TTS biraz hızlı gelir — hafif yavaşlat, daha doğal
    audio.playbackRate = 0.96;
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
    }, 5000);
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

    // 1) Microsoft Web Speech (tercih)
    if (speakWebSpeech(prepared, opts?.rate)) return;

    // 2) Google TTS yedek
    setSpeaking(true);
    const ok = await playGoogleFallback(prepared, token);
    if (token !== speakToken) return;
    if (!ok) {
      // Son çare: herhangi bir TR ses
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(prepared);
        u.lang = 'tr-TR';
        u.rate = 1.0;
        u.pitch = 1.04;
        u.volume = volume;
        const v = pickVoice();
        if (v) u.voice = v;
        u.onstart = () => setSpeaking(true);
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(u);
        return;
      }
      setSpeaking(false);
      return;
    }
    if (token === speakToken) setSpeaking(false);
  })();
}
