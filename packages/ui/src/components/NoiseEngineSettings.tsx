'use client';

import { useState } from 'react';
import { loadNoiseEngine, saveNoiseEngine, type NoiseEngine } from '../lib/rnnoise-processor';
import { SettingsSection } from './SettingsControls';
import { cn } from '../lib/cn';

/** A9 — which noise suppression runs when it is turned on in a call (web) */
export function NoiseEngineSettings() {
  const [engine, setEngine] = useState<NoiseEngine>(() => loadNoiseEngine());
  const opt = (id: NoiseEngine, label: string, hint: string) => (
    <button
      type="button"
      aria-pressed={engine === id}
      onClick={() => {
        setEngine(id);
        saveNoiseEngine(id);
      }}
      className={cn(
        'flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
        engine === id ? 'border-primary bg-primary-container/15' : 'border-outline-variant hover:border-primary',
      )}
    >
      <span className="block font-body-md text-on-surface">{label}</span>
      <span className="block font-body-sm text-on-surface-variant">{hint}</span>
    </button>
  );
  return (
    <SettingsSection title="Gürültü engelleme">
      <div className="flex flex-col sm:flex-row gap-2 px-space-md py-space-md">
        {opt('deepfilter', 'Güçlü (DeepFilterNet)', 'En iyi temizlik; ilk açılışta ~17 MB iner, işlemciyi daha çok kullanır.')}
        {opt('rnnoise', 'Hafif (RNNoise)', 'Zayıf bilgisayar ve dizüstüler için; anında açılır, az işlemci.')}
      </div>
      <p className="px-space-md pb-space-md font-body-sm text-outline">
        Seçim, ses kanalında gürültü engellemeyi bir sonraki açışında geçerli olur. Ses hiçbir zaman cihazından çıkmaz.
      </p>
    </SettingsSection>
  );
}
