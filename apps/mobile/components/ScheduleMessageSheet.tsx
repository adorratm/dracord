import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SCHEDULED_MESSAGE_LIMITS } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { Icon } from './Icon';
import { primaryBtn, primaryBtnText } from '../lib/ui';
import {
  formatScheduleTime,
  type ScheduledMessagesController,
} from '../lib/useScheduledMessages';

const DAY_LABELS = ['Bugün', 'Yarın', '2 gün sonra', '3 gün sonra', '1 hafta sonra'];
const DAY_OFFSETS = [0, 1, 2, 3, 7];

/**
 * Mobil mesaj zamanlama — gönder tuşuna uzun bas.
 * Hazır seçenekler + gün/saat/dakika seçici (ek bağımlılık yok) + bekleyenler listesi.
 */
export function ScheduleMessageSheet({
  visible,
  text,
  replyToId,
  scheduler,
  onClose,
  onScheduled,
}: {
  visible: boolean;
  text: string;
  replyToId?: string;
  scheduler: ScheduledMessagesController;
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const d = new Date(Date.now() + 60 * 60_000);
    setDayIdx(0);
    setHour(d.getHours());
    setMinute(Math.ceil(d.getMinutes() / 5) * 5 % 60);
    setError(null);
  }, [visible]);

  const custom = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAY_OFFSETS[dayIdx]!, hour, minute);
  }, [dayIdx, hour, minute]);

  const presets = useMemo(() => {
    const now = new Date();
    const inMin = (m: number) => new Date(now.getTime() + m * 60_000);
    return [
      { label: '30 dk', at: inMin(30) },
      { label: '1 saat', at: inMin(60) },
      { label: '3 saat', at: inMin(180) },
      { label: 'Yarın 09:00', at: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0) },
    ];
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (at: Date) => {
    if (at.getTime() < Date.now() + SCHEDULED_MESSAGE_LIMITS.minDelayMs - 5_000) {
      setError('En az 1 dakika sonrası seçilmeli');
      return;
    }
    setBusy(true);
    setError(null);
    const res = await scheduler.schedule(text, at, replyToId ? { replyToId } : undefined);
    setBusy(false);
    if (res.ok) {
      onScheduled();
      onClose();
    } else setError(res.error);
  };

  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={busy}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? colors.primary : colors.surfaceHigh,
      }}
    >
      <Text style={{ color: active ? colors.primaryOn : colors.text, fontWeight: '600', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );

  const stepper = (label: string, value: number, set: (n: number) => void, max: number, step: number) => (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable
          onPress={() => set((value - step + max) % max)}
          hitSlop={8}
          accessibilityLabel={`${label} azalt`}
          style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surfaceHigh }}
        >
          <Icon name="remove" size={18} />
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', minWidth: 34, textAlign: 'center' }}>
          {String(value).padStart(2, '0')}
        </Text>
        <Pressable
          onPress={() => set((value + step) % max)}
          hitSlop={8}
          accessibilityLabel={`${label} artır`}
          style={{ padding: 6, borderRadius: 8, backgroundColor: colors.surfaceHigh }}
        >
          <Icon name="add" size={18} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%' }}
        >
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
              {text ? 'Mesajı zamanla' : 'Zamanlanmış mesajlar'}
            </Text>
            {text ? (
              <>
                <Text
                  numberOfLines={3}
                  style={{ color: colors.textMuted, backgroundColor: colors.surfaceHigh, borderRadius: 10, padding: 10 }}
                >
                  {text}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {presets.map((p) => chip(p.label, false, () => void submit(p.at)))}
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Özel zaman</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DAY_LABELS.map((l, i) => chip(l, i === dayIdx, () => setDayIdx(i)))}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
                  {stepper('Saat', hour, setHour, 24, 1)}
                  {stepper('Dakika', minute, setMinute, 60, 5)}
                </View>
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  {formatScheduleTime(custom)} gönderilecek
                </Text>
                {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
                <Pressable style={[primaryBtn, { opacity: busy ? 0.6 : 1 }]} disabled={busy} onPress={() => void submit(custom)}>
                  <Text style={primaryBtnText}>{busy ? 'Zamanlanıyor…' : 'Zamanla'}</Text>
                </Pressable>
              </>
            ) : null}

            {scheduler.items.length ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Bu kanalda bekleyenler</Text>
                {scheduler.items.map((m) => (
                  <View
                    key={m.id}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceHigh, borderRadius: 10, padding: 10 }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                      {formatScheduleTime(m.sendAt)}
                    </Text>
                    <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                      {m.content || 'Ek'}
                    </Text>
                    <Pressable onPress={() => void scheduler.sendNow(m.id)} hitSlop={6}>
                      <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Şimdi</Text>
                    </Pressable>
                    <Pressable onPress={() => void scheduler.cancel(m.id)} hitSlop={6} accessibilityLabel="İptal">
                      <Icon name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
