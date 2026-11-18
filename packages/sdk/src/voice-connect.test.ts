import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_SIGNAL_FAILED_MESSAGE, connectVoiceWithFallback, isVoiceSignalError, voiceUrlCandidates } from './voice-connect';

const signal = () => new Error('could not establish signal connection: Encountered websocket error during connection establishment');
const noSleep = async () => undefined;

describe('voice connect fallback', () => {
  it('lists the main address first, then the fallbacks, once each', () => {
    assert.deepEqual(voiceUrlCandidates({ url: 'wss://rtc.x', fallbackUrls: ['wss://api.x/livekit', 'wss://rtc.x', 'http://nope', ''] }), ['wss://rtc.x', 'wss://api.x/livekit']);
    assert.deepEqual(voiceUrlCandidates({ url: 'wss://rtc.x' }, 'ws://local:7880'), ['ws://local:7880', 'wss://rtc.x']);
  });

  it('tells a signal failure from a refused join', () => {
    assert.equal(isVoiceSignalError(signal()), true);
    assert.equal(isVoiceSignalError(new Error('could not establish pc connection')), false);
    assert.equal(isVoiceSignalError(new Error('Permission denied')), false);
    assert.equal(isVoiceSignalError(new Error('401 unauthorized: invalid token')), false);
  });

  it('moves on to the fallback address when the main one cannot be reached', async () => {
    const tried: string[] = [];
    const url = await connectVoiceWithFallback(['wss://rtc', 'wss://api/livekit'], async (u) => {
      tried.push(u);
      if (u === 'wss://rtc') throw signal();
    }, { sleep: noSleep });
    assert.equal(url, 'wss://api/livekit');
    assert.deepEqual(tried, ['wss://rtc', 'wss://api/livekit']);
  });

  it('tries the list again after a pause (a blip), then gives a clear message', async () => {
    const tried: string[] = [];
    const pauses: number[] = [];
    await assert.rejects(
      connectVoiceWithFallback(['wss://a', 'wss://b'], async (u) => {
        tried.push(u);
        throw signal();
      }, { sleep: async (ms) => void pauses.push(ms), pauseMs: 900 }),
      { message: VOICE_SIGNAL_FAILED_MESSAGE },
    );
    assert.deepEqual(tried, ['wss://a', 'wss://b', 'wss://a', 'wss://b']);
    assert.deepEqual(pauses, [900]);
  });

  it('does not retry an error that is not about the connection', async () => {
    let n = 0;
    await assert.rejects(connectVoiceWithFallback(['wss://a', 'wss://b'], async () => {
      n++;
      throw new Error('Permission denied');
    }, { sleep: noSleep }), { message: 'Permission denied' });
    assert.equal(n, 1);
  });

  it('stops when the user has left meanwhile', async () => {
    let n = 0;
    let gone = false;
    await assert.rejects(connectVoiceWithFallback(['wss://a', 'wss://b'], async () => {
      n++;
      gone = true;
      throw signal();
    }, { sleep: noSleep, cancelled: () => gone }));
    assert.equal(n, 1);
  });
});
