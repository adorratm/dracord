const { RoomServiceClient } = require('livekit-server-sdk');

const url = (process.env.LIVEKIT_URL || 'ws://livekit:7880')
  .replace(/^ws/, 'http')
  .replace(/^wss/, 'https');
const key = process.env.LIVEKIT_API_KEY;
const secret = process.env.LIVEKIT_API_SECRET;
const room = process.argv[2] || 'dracord-voice-seed-ch-lounge';

const svc = new RoomServiceClient(url, key, secret);

(async () => {
  console.log('url', url, 'key', key?.slice(0, 8));
  const rooms = await svc.listRooms();
  console.log(
    'rooms',
    rooms.map((r) => ({ name: r.name, participants: r.numParticipants })),
  );
  try {
    const parts = await svc.listParticipants(room);
    for (const p of parts) {
      console.log('---', p.identity, p.name);
      for (const t of p.tracks || []) {
        console.log('  track', {
          sid: t.sid,
          type: t.type,
          source: t.source,
          muted: t.muted,
          width: t.width,
          height: t.height,
          mimeType: t.mimeType,
          stream: t.stream,
        });
      }
    }
  } catch (e) {
    console.error('listParticipants', e.message);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
