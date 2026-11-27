import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { channelIdFromHtml, kickDecision, parseHandle, parseYoutubeFeed, renderAlert } from './feeds';

const XML = `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><title>Kanal &amp; Ben</title>
<entry><yt:videoId>old11111111</yt:videoId><title>Eski</title><published>2026-11-01T10:00:00+00:00</published></entry>
<entry><yt:videoId>new22222222</yt:videoId><title>Yeni &quot;bölüm&quot;</title><published>2026-11-20T10:00:00+00:00</published></entry>
<entry><yt:videoId>bad id!</yt:videoId><title>x</title></entry></feed>`;

describe('stream feeds', () => {
  it('normalizes twitch input', () => {
    assert.deepEqual(parseHandle('twitch', 'https://www.twitch.tv/Pqueen'), { platform: 'twitch', handle: 'pqueen' });
    assert.deepEqual(parseHandle('twitch', '@abc_12'), { platform: 'twitch', handle: 'abc_12' });
    assert.equal(parseHandle('twitch', 'a b'), null);
  });

  it('normalizes youtube input', () => {
    assert.deepEqual(parseHandle('youtube', 'https://youtube.com/channel/UCabcdefghijklmnopqrstuv'), { platform: 'youtube', channelId: 'UCabcdefghijklmnopqrstuv' });
    assert.deepEqual(parseHandle('youtube', 'https://www.youtube.com/@Ruhi.Cenet'), { platform: 'youtube', at: '@Ruhi.Cenet' });
    assert.equal(parseHandle('youtube', 'javascript:alert(1)'), null);
  });

  it('parses the RSS feed newest first and skips junk ids', () => {
    const f = parseYoutubeFeed(XML);
    assert.equal(f.channelTitle, 'Kanal & Ben');
    assert.deepEqual(f.items.map((i) => i.id), ['new22222222', 'old11111111']);
    assert.equal(f.items[0]!.title, 'Yeni "bölüm"');
  });

  it('finds a channel id in page html', () => {
    assert.equal(channelIdFromHtml('<link rel="canonical" href="https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv">'), 'UCabcdefghijklmnopqrstuv');
    assert.equal(channelIdFromHtml('<html>yok</html>'), null);
  });

  it('renders templates and always keeps the link', () => {
    const v = { name: 'Ayşe', title: 'Okey\ngecesi', url: 'https://twitch.tv/ayse', platform: 'twitch' as const, live: true };
    assert.match(renderAlert(null, v), /Ayşe.*Okey gecesi/);
    assert.equal(renderAlert('{name} yayında!', v), 'Ayşe yayında!\nhttps://twitch.tv/ayse');
  });
});

describe('kick', () => {
  it('normalizes kick input', () => {
    assert.deepEqual(parseHandle('kick', 'https://kick.com/Ayse_Oyun'), { platform: 'kick', handle: 'ayse_oyun' });
    assert.deepEqual(parseHandle('kick', '@xqc'), { platform: 'kick', handle: 'xqc' });
    assert.equal(parseHandle('kick', 'a b'), null);
  });

  it('notifies once per stream and marks offline', () => {
    const now = Date.parse('2026-11-27T20:00:00Z');
    const live = { live: true, startedAt: '2026-11-27T19:58:00Z', title: 'Okey' };
    const fresh = { isLive: false, lastItemId: null, lastError: null };
    assert.deepEqual(kickDecision(fresh, live, now), { kind: 'live', itemId: live.startedAt, notify: true });
    assert.deepEqual(kickDecision({ ...fresh, isLive: true, lastItemId: live.startedAt }, live, now), { kind: 'none' });
    const old = { ...live, startedAt: '2026-11-27T15:00:00Z' };
    assert.deepEqual(kickDecision(fresh, old, now), { kind: 'live', itemId: old.startedAt, notify: false });
    assert.deepEqual(kickDecision({ ...fresh, isLive: true, lastItemId: 'x' }, { live: false, startedAt: null, title: '' }, now), { kind: 'offline' });
    assert.match(renderAlert(null, { name: 'ayse', title: 'Okey', url: 'https://kick.com/ayse', platform: 'kick', live: true }), /Kick'te canlı/);
  });
});
