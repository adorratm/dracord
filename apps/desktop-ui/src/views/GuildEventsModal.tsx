import type { ChannelSummary, GuildEventDto } from '@dracord/types';
import { Modal, SearchableSelect, cn } from '@dracord/ui';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth';
import { DracoEmpty } from '../components/Draco';

type WizardStep = 1 | 2 | 3;

export function GuildEventsModal({
  open,
  onClose,
  guildId,
  channels,
}: {
  open: boolean;
  onClose: () => void;
  guildId: string;
  channels: ChannelSummary[];
}) {
  const { client } = useAuth();
  const [events, setEvents] = useState<GuildEventDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [channelId, setChannelId] = useState('');

  const load = useCallback(async () => {
    try {
      const list = await client.listGuildEvents(guildId);
      setEvents(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Etkinlikler yüklenemedi');
    }
  }, [client, guildId]);

  useEffect(() => {
    if (!open) return;
    setWizard(false);
    setStep(1);
    void load();
  }, [open, load]);

  const resetWizard = () => {
    setWizard(false);
    setStep(1);
    setTitle('');
    setDescription('');
    setStartsAt('');
    setLocation('');
    setChannelId('');
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await client.createGuildEvent(guildId, {
        title: title.trim(),
        description: description.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        location: location.trim() || null,
        channelId: channelId || null,
      });
      resetWizard();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await client.deleteGuildEvent(guildId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  const channelOptions = [
    { value: '', label: 'Kanal yok' },
    ...channels
      .filter((c) => c.type === 'TEXT' || c.type === 'VOICE')
      .map((c) => ({ value: c.id, label: `#${c.name}` })),
  ];

  return (
    <Modal
      open={open}
      title={wizard ? 'Etkinlik oluştur' : 'Etkinlikler'}
      onClose={() => {
        resetWizard();
        onClose();
      }}
      footer={
        wizard ? (
          <div className="flex gap-2 justify-end w-full">
            {step > 1 && (
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-surface-container-high font-label-sm"
                onClick={() => setStep((s) => (s - 1) as WizardStep)}
              >
                Geri
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                disabled={step === 1 && title.trim().length < 2}
                onClick={() => setStep((s) => (s + 1) as WizardStep)}
              >
                İleri
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !startsAt}
                className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm disabled:opacity-50"
                onClick={() => void create()}
              >
                Oluştur
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="h-9 px-3 rounded-lg bg-primary-container text-on-primary-container font-label-sm"
            onClick={() => {
              setWizard(true);
              setStep(1);
            }}
          >
            Yeni etkinlik
          </button>
        )
      }
    >
      {error && <p className="mb-3 font-body-sm text-error">{error}</p>}

      {!wizard ? (
        events.length === 0 ? (
          <DracoEmpty
            mood="peek"
            size={88}
            title="Henüz etkinlik yok"
            description="Yeni bir tane planla — Draco heyecanla bekliyor."
          />
        ) : (
          <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-surface-container-highest bg-surface-container-low px-3 py-2 flex gap-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-on-surface truncate">{e.title}</p>
                  <p className="font-label-sm text-outline mt-0.5">
                    {new Date(e.startsAt).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {e.location ? ` · ${e.location}` : ''}
                  </p>
                  {e.description && (
                    <p className="font-body-sm text-on-surface-variant mt-1 line-clamp-2">
                      {e.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  className="h-8 w-8 rounded-md text-error hover:bg-error/10 shrink-0"
                  aria-label="İptal et"
                  onClick={() => void remove(e.id)}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex gap-1 mb-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  step >= n ? 'bg-primary-container' : 'bg-surface-container-highest',
                )}
              />
            ))}
          </div>
          {step === 1 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">Başlık</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                  placeholder="Haftalık turnuva"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">Açıklama</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="px-3 py-2 rounded-lg bg-surface-container-highest outline-none resize-none font-body-sm"
                  placeholder="Ne olacak?"
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">Başlangıç</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">Konum / link</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-10 px-3 rounded-lg bg-surface-container-highest outline-none"
                  placeholder="Ses kanalı veya URL"
                />
              </label>
            </>
          )}
          {step === 3 && (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-label-sm text-on-surface-variant">Bağlı kanal</span>
                <SearchableSelect
                  value={channelId}
                  onChange={setChannelId}
                  options={channelOptions}
                  fullWidth
                  aria-label="Kanal"
                />
              </label>
              <div className="rounded-lg bg-surface-container-low border border-surface-container-highest p-3">
                <p className="font-label-md text-on-surface">{title || 'Başlıksız'}</p>
                <p className="font-label-sm text-outline mt-1">
                  {startsAt
                    ? new Date(startsAt).toLocaleString('tr-TR')
                    : 'Zaman seçilmedi'}
                </p>
                {description && (
                  <p className="font-body-sm text-on-surface-variant mt-2">{description}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
