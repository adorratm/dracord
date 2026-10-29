import { Injectable } from '@nestjs/common';

/** Basit süreç içi sayaçlar — oyun sync gözlemi */
@Injectable()
export class ActivitySyncMetricsService {
  private patches = 0;
  private conflicts = 0;
  private casMissing = 0;
  private billiardsShotRejected = 0;
  private lastConflictAt: string | null = null;

  recordPatch() {
    this.patches += 1;
  }

  recordConflict() {
    this.conflicts += 1;
    this.lastConflictAt = new Date().toISOString();
  }

  recordCasMissing() {
    this.casMissing += 1;
  }

  recordBilliardsShotRejected() {
    this.billiardsShotRejected += 1;
  }

  snapshot() {
    return {
      patches: this.patches,
      conflicts: this.conflicts,
      casMissing: this.casMissing,
      billiardsShotRejected: this.billiardsShotRejected,
      lastConflictAt: this.lastConflictAt,
    };
  }
}
