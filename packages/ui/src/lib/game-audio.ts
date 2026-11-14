/**
 * Voice vs. game audio in game rooms.
 *
 * While a game frame is open, voice chat is played louder (it is otherwise mixed with
 * headroom and sits under the game), and the game is told to duck its own sound
 * whenever someone else in the room is talking. Module state on purpose: the voice
 * provider and every GameFrame in the same window share it without prop plumbing.
 */

/** extra gain for voice while a game is open (still capped below clipping) */
export const GAME_VOICE_BOOST = 2;
const BOOST_CAP = 0.92;

let openFrames = 0;
let othersSpeaking = false;
const frameListeners = new Set<() => void>();
const speakListeners = new Set<(speaking: boolean) => void>();

/** Call when a game frame mounts; the returned function un-registers it. */
export function registerGameFrame(): () => void {
  openFrames += 1;
  frameListeners.forEach((f) => f());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    openFrames = Math.max(0, openFrames - 1);
    frameListeners.forEach((f) => f());
  };
}

export function isGameFrameOpen(): boolean {
  return openFrames > 0;
}

/** Listen level for a remote voice track, boosted while a game is open. */
export function gameVoiceLevel(level: number): number {
  if (openFrames <= 0) return level;
  return Math.min(BOOST_CAP, Math.max(level, level * GAME_VOICE_BOOST));
}

export function onGameFrameChange(f: () => void): () => void {
  frameListeners.add(f);
  return () => frameListeners.delete(f);
}

/** The voice provider reports whether anyone else in the call is talking. */
export function reportVoiceActivity(speaking: boolean): void {
  if (speaking === othersSpeaking) return;
  othersSpeaking = speaking;
  speakListeners.forEach((f) => f(speaking));
}

export function isVoiceActive(): boolean {
  return othersSpeaking;
}

export function onVoiceActivity(f: (speaking: boolean) => void): () => void {
  speakListeners.add(f);
  return () => speakListeners.delete(f);
}
