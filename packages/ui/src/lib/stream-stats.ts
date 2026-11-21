/** Yayın istatistiği (RTCStatsReport → okunur özet). DOM'suz; web/desktop paylaşır. */
export interface StreamStats {
  direction: 'in' | 'out';
  width: number | null;
  height: number | null;
  fps: number | null;
  /** kbps, iki örnek arası */
  kbps: number | null;
  /** % (gelen için kayıp paket; giden için uzak uçtan bildirilen) */
  lossPct: number | null;
  codec: string | null;
  jitterMs: number | null;
  rttMs: number | null;
  /** gönderen: neden sınırlandı (bandwidth/cpu) */
  limitation: string | null;
  /** SVC/simulcast katmanı sayısı (giden) */
  layers: number;
}

type Prev = { bytes: number; ts: number } | null;

type Rec = Record<string, unknown> & { type: string; id: string; kind?: string; mediaType?: string };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** report + önceki örnek → özet ve yeni örnek */
export function summarizeStats(report: RTCStatsReport, prev: Prev): { stats: StreamStats | null; next: Prev } {
  const all: Rec[] = [];
  report.forEach((r) => all.push(r as Rec));
  const isVideo = (r: Rec) => (r.kind ?? r.mediaType) === 'video';
  const inbound = all.filter((r) => r.type === 'inbound-rtp' && isVideo(r));
  const outbound = all.filter((r) => r.type === 'outbound-rtp' && isVideo(r));
  const byId = new Map(all.map((r) => [r.id, r]));
  const codecName = (r: Rec | undefined) => {
    const c = r?.codecId ? byId.get(String(r.codecId)) : undefined;
    const m = c?.mimeType ? String(c.mimeType) : null;
    return m ? m.replace(/^video\//i, '').toUpperCase() : null;
  };
  const ts = Date.now();
  if (inbound.length) {
    const r = inbound.sort((a, b) => (num(b.frameWidth) ?? 0) - (num(a.frameWidth) ?? 0))[0]!;
    const bytes = num(r.bytesReceived) ?? 0;
    const lost = num(r.packetsLost) ?? 0;
    const recv = num(r.packetsReceived) ?? 0;
    const pair = all.find((x) => x.type === 'candidate-pair' && (x.nominated || x.selected) && x.state === 'succeeded');
    const kbps = prev && ts > prev.ts ? Math.max(0, ((bytes - prev.bytes) * 8) / (ts - prev.ts)) : null;
    return {
      next: { bytes, ts },
      stats: {
        direction: 'in',
        width: num(r.frameWidth),
        height: num(r.frameHeight),
        fps: num(r.framesPerSecond),
        kbps: kbps === null ? null : Math.round(kbps),
        lossPct: recv + lost > 0 ? Math.round((lost / (recv + lost)) * 1000) / 10 : null,
        codec: codecName(r),
        jitterMs: num(r.jitter) === null ? null : Math.round(num(r.jitter)! * 1000),
        rttMs: num(pair?.currentRoundTripTime) === null ? null : Math.round(num(pair?.currentRoundTripTime)! * 1000),
        limitation: null,
        layers: 1,
      },
    };
  }
  if (outbound.length) {
    const active = outbound.filter((r) => r.active !== false);
    const top = (active.length ? active : outbound).sort((a, b) => (num(b.frameWidth) ?? 0) - (num(a.frameWidth) ?? 0))[0]!;
    const bytes = outbound.reduce((s, r) => s + (num(r.bytesSent) ?? 0), 0);
    const kbps = prev && ts > prev.ts ? Math.max(0, ((bytes - prev.bytes) * 8) / (ts - prev.ts)) : null;
    const remote = all.find((x) => x.type === 'remote-inbound-rtp' && isVideo(x));
    const fl = num(remote?.fractionLost);
    const lim = top.qualityLimitationReason ? String(top.qualityLimitationReason) : null;
    return {
      next: { bytes, ts },
      stats: {
        direction: 'out',
        width: num(top.frameWidth),
        height: num(top.frameHeight),
        fps: num(top.framesPerSecond),
        kbps: kbps === null ? null : Math.round(kbps),
        lossPct: fl === null ? null : Math.round(fl * 1000) / 10,
        codec: codecName(top),
        jitterMs: num(remote?.jitter) === null ? null : Math.round(num(remote?.jitter)! * 1000),
        rttMs: num(remote?.roundTripTime) === null ? null : Math.round(num(remote?.roundTripTime)! * 1000),
        limitation: lim && lim !== 'none' ? lim : null,
        layers: active.length || outbound.length,
      },
    };
  }
  return { stats: null, next: prev };
}
