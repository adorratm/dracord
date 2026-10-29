import { Injectable } from '@nestjs/common';

/** Socket.IO Redis adapter durumu — health / ready */
@Injectable()
export class SocketAdapterStateService {
  private enabled = false;
  private error: string | null = null;
  private lastChangeAt: string | null = null;

  markEnabled() {
    this.enabled = true;
    this.error = null;
    this.lastChangeAt = new Date().toISOString();
  }

  markFailed(message: string) {
    this.enabled = false;
    this.error = message;
    this.lastChangeAt = new Date().toISOString();
  }

  snapshot() {
    return {
      redisAdapter: this.enabled,
      error: this.error,
      updatedAt: this.lastChangeAt,
    };
  }

  isReady() {
    return this.enabled;
  }
}
