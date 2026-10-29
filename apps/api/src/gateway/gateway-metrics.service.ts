import { Injectable } from '@nestjs/common';

/** Socket.IO / presence / voice gözlem sayaçları */
@Injectable()
export class GatewayMetricsService {
  private connections = 0;
  private disconnects = 0;
  private graceCancelled = 0;
  private offlineMarked = 0;
  private voiceOrphansCleared = 0;
  private voiceSyncs = 0;
  private lastOfflineAt: string | null = null;
  private lastOrphanClearAt: string | null = null;

  recordConnect() {
    this.connections += 1;
  }

  recordDisconnect() {
    this.disconnects += 1;
  }

  recordGraceCancelled() {
    this.graceCancelled += 1;
  }

  recordOffline() {
    this.offlineMarked += 1;
    this.lastOfflineAt = new Date().toISOString();
  }

  recordVoiceOrphanClear(count: number) {
    this.voiceOrphansCleared += count;
    this.lastOrphanClearAt = new Date().toISOString();
  }

  recordVoiceSync() {
    this.voiceSyncs += 1;
  }

  snapshot() {
    return {
      connections: this.connections,
      disconnects: this.disconnects,
      graceCancelled: this.graceCancelled,
      offlineMarked: this.offlineMarked,
      voiceOrphansCleared: this.voiceOrphansCleared,
      voiceSyncs: this.voiceSyncs,
      lastOfflineAt: this.lastOfflineAt,
      lastOrphanClearAt: this.lastOrphanClearAt,
    };
  }
}
