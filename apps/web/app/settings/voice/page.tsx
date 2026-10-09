'use client';

import { useEffect } from 'react';
import { SearchableSelect } from '@dracord/ui';
import { useVoiceSession } from '@/components/VoiceSessionProvider';
import {
  SCREEN_SHARE_FPS_PRESETS,
  SCREEN_SHARE_RESOLUTION_PRESETS,
  SCREEN_SHARE_RESOLUTION_SPECS,
  SCREEN_SHARE_VIEW_QUALITY_PRESETS,
  SCREEN_SHARE_VIEW_QUALITY_SPECS,
  VOICE_BITRATE_PRESETS,
  type ScreenShareFps,
  type ScreenShareResolutionId,
  type ScreenShareViewQualityId,
  type VoiceBitrateKbps,
} from '@/lib/voice-settings';

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
      <SearchableSelect
        fullWidth
        value={value}
        onChange={onChange}
        aria-label={label}
        placeholder="Sistem varsayılanı"
        options={[
          { value: '', label: 'Sistem varsayılanı' },
          ...devices.map((d) => ({
            value: d.deviceId,
            label: d.label || `Aygıt (${d.deviceId.slice(0, 8)})`,
          })),
        ]}
      />
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
        <p className="font-body-sm text-outline">
          %100 bile headroom’lu (≈ −5 dB); patlamayı azaltır. Daha yüksek için kaydırıcıyı
          %100’ün üzerine çek. Limiter her zaman açıktır.
        </p>
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <h3 className="font-headline-md text-headline-md text-on-surface">Ses kalitesi</h3>
        <p className="font-body-sm text-on-surface-variant">
          Mikrofon yayın bitrate’i. Varsayılan 128 kbps (dengeli). Daha yüksek değerler bant
          kullanır; çok yüksek gain ile birlikte patlamaya yol açabilir.
        </p>
        <label className="flex flex-col gap-space-xs">
          <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">high_quality</span>
            Yayın kalitesi
          </span>
          <SearchableSelect
            fullWidth
            value={String(voice.audioSettings.audioBitrateKbps)}
            onChange={(v) => void voice.setAudioBitrate(Number(v) as VoiceBitrateKbps)}
            aria-label="Yayın kalitesi"
            options={VOICE_BITRATE_PRESETS.map((kbps) => ({
              value: String(kbps),
              label: `${kbps} kbps${kbps === 320 ? ' — En yüksek' : kbps === 128 ? ' — Önerilen' : kbps === 32 ? ' — En düşük' : ''}`,
            }))}
          />
        </label>
        {voice.connected && (
          <p className="font-body-sm text-outline">
            Değişiklik bu oturumda hemen uygulanır.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-surface-container-low p-space-lg space-y-space-lg">
        <h3 className="font-headline-md text-headline-md text-on-surface">Ekran paylaşımı</h3>
        <p className="font-body-sm text-on-surface-variant">
          Çözünürlük ve FPS kişisel ayardır (bu tarayıcıda saklanır). Paylaşım sırasında
          değiştirirsen paylaşım yeniden başlar; tarayıcı ekranın gerçek çözünürlüğünü aşamaz.
        </p>
        <div className="rounded-lg border border-outline-variant/40 bg-surface-container px-space-md py-space-sm space-y-1">
          <p className="font-label-sm text-on-surface flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px] text-primary-container">
              shield
            </span>
            Otomatik uygunsuz içerik engeli
          </p>
          <p className="font-body-sm text-on-surface-variant">
            Ekran ve kamera yayını yerelde taranır; pornografi / hentai tespiti paylaşımı veya
            kamerayı anında keser. İzlerken de aynı kontrol uygulanır. Engel sonrası kısa bir
            bekleme süresi vardır — kapatılamaz.
          </p>
        </div>
        <label className="flex flex-col gap-space-xs">
          <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">screenshot_monitor</span>
            Çözünürlük
          </span>
          <SearchableSelect
            fullWidth
            value={voice.audioSettings.screenShareResolution}
            onChange={(v) => void voice.setScreenShareResolution(v as ScreenShareResolutionId)}
            aria-label="Ekran paylaşımı çözünürlüğü"
            options={SCREEN_SHARE_RESOLUTION_PRESETS.map((id) => ({
              value: id,
              label: SCREEN_SHARE_RESOLUTION_SPECS[id].label,
            }))}
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">speed</span>
            Kare hızı (FPS)
          </span>
          <SearchableSelect
            fullWidth
            value={String(voice.audioSettings.screenShareFps)}
            onChange={(v) => void voice.setScreenShareFps(Number(v) as ScreenShareFps)}
            aria-label="Ekran paylaşımı FPS"
            options={SCREEN_SHARE_FPS_PRESETS.map((fps) => ({
              value: String(fps),
              label: `${fps} FPS${fps === 30 ? ' — Önerilen' : fps === 60 ? ' — Akıcı' : ''}`,
            }))}
          />
        </label>
        <label className="flex flex-col gap-space-xs">
          <span className="flex items-center gap-space-sm font-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">hd</span>
            İzleme kalitesi
          </span>
          <SearchableSelect
            fullWidth
            value={voice.audioSettings.screenShareViewQuality}
            onChange={(v) =>
              voice.setScreenShareViewQuality(v as ScreenShareViewQualityId)
            }
            aria-label="Ekran paylaşımı izleme kalitesi"
            options={SCREEN_SHARE_VIEW_QUALITY_PRESETS.map((id) => ({
              value: id,
              label: SCREEN_SHARE_VIEW_QUALITY_SPECS[id].label,
            }))}
          />
        </label>
        <p className="font-body-sm text-outline">
          İzleme kalitesi başkalarının paylaşımını izlerken geçerlidir; sahne üstünden de
          değiştirilebilir.
        </p>
        {voice.screenSharing && (
          <p className="font-body-sm text-outline">
            Şu an paylaşım açık — çözünürlük/FPS değişikliği paylaşımı yeniden başlatır.
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
