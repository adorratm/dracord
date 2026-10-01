'use client';

import { useEffect } from 'react';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import { VOICE_BITRATE_PRESETS, type VoiceBitrateKbps } from '@/lib/voice-settings';

function VolumeSlider({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <label className="flex flex-col gap-space-sm">
      <span className="flex items-center justify-between gap-space-md">
        <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
          {label}
        </span>
        <span className="font-label-sm text-outline tabular-nums">{pct}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={200}
        step={1}
        value={pct}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-primary-container"
      />
    </label>
  );
}

function DeviceSelect({
  label,
  icon,
  value,
  devices,
  onChange,
}: {
  label: string;
  icon: string;
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (deviceId: string) => void;
}) {
  return (
    <label className="flex flex-col gap-space-xs">
      <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 px-space-sm rounded-lg bg-surface-container-highest text-on-surface font-body-sm outline-none"
      >
        <option value="">Sistem varsayılanı</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Aygıt (${d.deviceId.slice(0, 8)})`}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function VoiceSettingsPage() {
  const voice = useVoiceSession();

  useEffect(() => {
    void voice.refreshAudioDevices(true);
  }, [voice.refreshAudioDevices]);

  return (
    <div className="max-w-2xl px-space-xl py-space-xl space-y-space-lg">
      <div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface">Ses ve Görüntü</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-space-xs">
          Mikrofon, kulaklık, kamera, ses kalitesi ve varsayılan aygıtları buradan yönet.
          Ayarlar bu tarayıcıda saklanır; ses kanalındayken anında uygulanır.
          Her kullanıcının sesini ayrıca ses sahnesindeki kaydırıcıdan ayarlayabilirsin.
        </p>
      </div>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <h3 className="font-headline-md text-headline-md text-on-surface">Ses seviyeleri</h3>
        <VolumeSlider
          label="Mikrofon"
          icon="mic"
          value={voice.audioSettings.micVolume}
          onChange={voice.setMicVolume}
        />
        <VolumeSlider
          label="Kulaklık / hoparlör"
          icon="headphones"
          value={voice.audioSettings.outputVolume}
          onChange={voice.setOutputVolume}
        />
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <h3 className="font-headline-md text-headline-md text-on-surface">Ses kalitesi</h3>
        <p className="font-body-sm text-on-surface-variant">
          Mikrofon yayın bitrate’i. Varsayılan en yüksek (320 kbps). Daha düşük değerler bant
          genişliği tasarruf eder; tarayıcı yine de desteklediği üst sınıra kadar çıkar.
        </p>
        <label className="flex flex-col gap-space-xs">
          <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">high_quality</span>
            Yayın kalitesi
          </span>
          <select
            value={voice.audioSettings.audioBitrateKbps}
            onChange={(e) => void voice.setAudioBitrate(Number(e.target.value) as VoiceBitrateKbps)}
            className="h-10 px-space-sm rounded-lg bg-surface-container-highest text-on-surface font-body-sm outline-none"
          >
            {VOICE_BITRATE_PRESETS.map((kbps) => (
              <option key={kbps} value={kbps}>
                {kbps} kbps{kbps === 320 ? ' — En yüksek' : kbps === 32 ? ' — En düşük' : ''}
              </option>
            ))}
          </select>
        </label>
        {voice.connected && (
          <p className="font-body-sm text-outline">
            Değişiklik bu oturumda hemen uygulanır.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <div className="flex items-center justify-between gap-space-md">
          <h3 className="font-headline-md text-headline-md text-on-surface">Ses aygıtları</h3>
          <button
            type="button"
            onClick={() => void voice.refreshAudioDevices(true)}
            className="font-label-sm text-primary-container hover:underline"
          >
            Yenile
          </button>
        </div>
        <DeviceSelect
          label="Giriş aygıtı (mikrofon)"
          icon="mic"
          value={voice.audioSettings.inputDeviceId}
          devices={voice.audioInputDevices}
          onChange={(id) => void voice.setInputDevice(id)}
        />
        <DeviceSelect
          label="Çıkış aygıtı (kulaklık / hoparlör)"
          icon="speaker"
          value={voice.audioSettings.outputDeviceId}
          devices={voice.audioOutputDevices}
          onChange={(id) => void voice.setOutputDevice(id)}
        />
        {voice.audioInputDevices.length === 0 && voice.audioOutputDevices.length === 0 && (
          <p className="font-body-sm text-outline">
            Aygıt listesi boşsa tarayıcı mikrofon iznini ver; ardından Yenile’ye bas.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <div className="flex items-center justify-between gap-space-md">
          <h3 className="font-headline-md text-headline-md text-on-surface">Kamera</h3>
          <button
            type="button"
            onClick={() => void voice.refreshAudioDevices(true)}
            className="font-label-sm text-primary-container hover:underline"
          >
            Yenile
          </button>
        </div>
        <p className="font-body-sm text-on-surface-variant">
          Varsayılan webcam’i seç. Ses kanalındayken alttaki kamera düğmesiyle açıp kapatabilirsin.
        </p>
        <DeviceSelect
          label="Kamera aygıtı"
          icon="videocam"
          value={voice.audioSettings.videoDeviceId}
          devices={voice.videoInputDevices}
          onChange={(id) => void voice.setVideoDevice(id)}
        />
        {voice.connected ? (
          <div className="flex items-center justify-between gap-space-md">
            <span className="font-body-sm text-on-surface">
              Kamera: {voice.cameraEnabled ? 'Açık' : 'Kapalı'}
            </span>
            <button
              type="button"
              onClick={() => void voice.toggleCamera()}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              {voice.cameraEnabled ? 'Kamerayı kapat' : 'Kamerayı aç'}
            </button>
          </div>
        ) : (
          <p className="font-body-sm text-outline">
            Kamerayı denemek için önce bir ses kanalına katıl.
          </p>
        )}
        {voice.videoInputDevices.length === 0 && (
          <p className="font-body-sm text-outline">
            Kamera listesi boşsa tarayıcı kamera iznini ver; ardından Yenile’ye bas.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-md">
        <h3 className="font-headline-md text-headline-md text-on-surface">Gürültü engelleme</h3>
        <p className="font-body-sm text-on-surface-variant">
          Ses kanalında User Panel’deki gürültü engelleme ile DeepFilterNet açılır. Desteklenmeyen
          tarayıcılarda yerleşik noise suppression kullanılır.
        </p>
        {voice.connected ? (
          <div className="flex items-center justify-between gap-space-md">
            <span className="font-body-sm text-on-surface">
              {voice.noiseCancellation ? 'Açık' : 'Kapalı'}
              {voice.noiseNote ? ` — ${voice.noiseNote}` : ''}
            </span>
            <button
              type="button"
              onClick={() => void voice.toggleNoiseCancellation()}
              className="px-space-md py-space-sm rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            >
              {voice.noiseCancellation ? 'Kapat' : 'Aç'}
            </button>
          </div>
        ) : (
          <p className="font-body-sm text-outline">
            Gürültü engellemeyi açmak için önce bir ses kanalına katıl.
          </p>
        )}
      </section>
    </div>
  );
}
