/** Blackjack kurpiyer — Web Speech TTS (Türkçe kadın ses tercih). */

let muted = false;
let speaking = false;
let onSpeakingChange: ((v: boolean) => void) | null = null;

export function setDealerVoiceMuted(next: boolean) {
  muted = next;
  if (next && typeof window !== 'undefined') window.speechSynthesis?.cancel();
  setSpeaking(false);
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

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const trFemale = voices.find(
    (v) =>
      /tr(-|_|$)/i.test(v.lang) &&
      /(female|woman|kız|kadin|kadın|aylin|emel|filiz|yelda|zira)/i.test(v.name),
  );
  if (trFemale) return trFemale;
  const tr = voices.find((v) => /tr(-|_|$)/i.test(v.lang));
  if (tr) return tr;
  const female = voices.find((v) => /(female|woman)/i.test(v.name));
  return female ?? voices[0] ?? null;
}

/** Ses listesi async yüklenir — ilk çağrıda warm-up */
export function warmDealerVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

export function speakDealer(text: string, opts?: { interrupt?: boolean; rate?: number }) {
  if (muted || typeof window === 'undefined' || !window.speechSynthesis) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  if (opts?.interrupt !== false) window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(trimmed);
  u.lang = 'tr-TR';
  u.rate = opts?.rate ?? 1.02;
  u.pitch = 1.12;
  u.volume = 1;
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  setSpeaking(true);
  window.speechSynthesis.speak(u);
}

export function stopDealerSpeech() {
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  setSpeaking(false);
}
