/**
 * Bot WebSocket Gateway sözleşmesi (Socket.IO namespace).
 *
 * Bağlantı: `{api}/v1/gateway` (Socket.IO path default /socket.io)
 * Event: `packet` — { op, t?, s?, d? }
 *
 * op: 0 Dispatch · 1 Heartbeat · 2 Identify · 9 Invalid · 10 Hello · 11 ACK
 * Identify: { op: 2, d: { token, shard?: [id, count], intents? } }
 * Guild → shard: `(BigInt(guildId) >> 22n) % shardCount` (Discord-parity)
 */

export type BotGatewayOpcode =
  | 0 // Dispatch
  | 1 // Heartbeat
  | 2 // Identify
  | 7 // Reconnect
  | 9 // Invalid session
  | 10 // Hello
  | 11; // Heartbeat ACK

export type BotGatewayHello = {
  op: 10;
  d: {
    heartbeat_interval: number;
    shard_count?: number;
    shard_id?: number;
  };
};

export type BotGatewayIdentify = {
  op: 2;
  d: {
    token: string;
    intents?: number;
    /** Discord-parity: [shard_id, num_shards] */
    shard?: [number, number];
  };
};

export const BOT_GATEWAY_PATH = '/v1/gateway';
export const BOT_GATEWAY_STATUS = 'live' as const;
