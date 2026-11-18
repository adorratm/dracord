'use client';

import { KeybindCapture } from './KeybindCapture';
import { SettingsNote, SettingsSection, SettingsSlider, SettingsToggle } from './SettingsControls';
import { useVoiceInputSettings } from '../lib/use-voice-input';
import { cn } from '../lib/cn';

interface VoiceInputSettingsProps {
  /** where the hotkeys work on this platform, shown under the section */
  scopeNote: string;
}

/** A8 — "Giriş modu" + push-to-talk key + mute / deafen hotkeys (web and desktop settings). */
export function VoiceInputSettings({ scopeNote }: VoiceInputSettingsProps) {
  const [s, update] = useVoiceInputSettings();
  const modeBtn = (mode: 'voice' | 'ptt', label: string, hint: string) => (
    <button
      type="button"
      onClick={() => update({ mode })}
      aria-pressed={s.mode === mode}
      className={cn(
        'flex-1 rounded-lg border px-3 py-2 text-left transition-colors',
        s.mode === mode ? 'border-primary bg-primary-container/15' : 'border-outline-variant hover:border-primary',
      )}
    >
      <span className="block font-body-md text-on-surface">{label}</span>
      <span className="block font-body-sm text-on-surface-variant">{hint}</span>
    </button>
  );
  return (
    <>
      <SettingsSection title="Giriş modu">
        <div className="flex gap-2 px-space-md py-space-md">
          {modeBtn('voice', 'Ses etkinliği', 'Konuşunca mikrofon açılır')}
          {modeBtn('ptt', 'Bas-konuş', 'Yalnız tuşa basılıyken konuşursun')}
        </div>
        {s.mode === 'ptt' ? (
          <>
            <KeybindCapture
              label="Bas-konuş tuşu"
              description="Klavye tuşu, tek başına Ctrl/Alt ya da farenin yan tuşları olabilir."
              value={s.pttKey}
              onChange={(pttKey) => update({ pttKey })}
              allowMouse
              allowLoneModifier
            />
            <SettingsSlider
              label="Bırakma gecikmesi"
              description="Tuşu bıraktıktan sonra sesin açık kalacağı süre — cümlenin sonu kesilmez."
              value={s.pttReleaseMs}
              min={0}
              max={1000}
              step={20}
              suffix=" ms"
              onChange={(pttReleaseMs) => update({ pttReleaseMs })}
            />
            <SettingsToggle
              label="Bas-konuş sesi"
              description="Mikrofon açılıp kapanırken kısa bir tık sesi çalar."
              checked={s.pttSounds}
              onChange={(pttSounds) => update({ pttSounds })}
            />
            {!s.pttKey ? <SettingsNote>Bas-konuş için bir tuş seç; seçilene kadar mikrofonun kapalı kalır.</SettingsNote> : null}
          </>
        ) : null}
      </SettingsSection>
      <SettingsSection title="Ses kısayolları">
        <KeybindCapture label="Sustur / aç" value={s.muteKey} onChange={(muteKey) => update({ muteKey })} />
        <KeybindCapture label="Sağırlaştır / aç" value={s.deafenKey} onChange={(deafenKey) => update({ deafenKey })} />
        <SettingsNote>{scopeNote}</SettingsNote>
      </SettingsSection>
    </>
  );
}
