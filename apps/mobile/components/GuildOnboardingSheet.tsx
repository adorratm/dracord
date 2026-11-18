import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GuildOnboardingCompleteResult, GuildOnboardingDto, GuildOnboardingQuestion } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';

type Step = { kind: 'rules' } | { kind: 'q'; q: GuildOnboardingQuestion };

/** B5 — katılış ekranı (kurallar → sorular → rol + kanal önerisi), sunucu ilk açılınca bir kez */
export function GuildOnboardingSheet({
  guildId,
  onSuggestedChannel,
}: {
  guildId: string;
  onSuggestedChannel?: (channelId: string) => void;
}) {
  const { client } = useAuth();
  const [cfg, setCfg] = useState<GuildOnboardingDto | null>(null);
  const [step, setStep] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    let off = false;
    client
      .getGuildOnboarding(guildId)
      .then((c) => !off && setCfg(c))
      .catch(() => undefined);
    return () => {
      off = true;
    };
  }, [client, guildId]);

  const steps = useMemo<Step[]>(
    () => (cfg ? [...(cfg.rules.length ? [{ kind: 'rules' as const }] : []), ...cfg.questions.map((q) => ({ kind: 'q' as const, q }))] : []),
    [cfg],
  );
  if (!cfg || !cfg.enabled || cfg.completed || closed || steps.length === 0) return null;
  const cur = steps[Math.min(step, steps.length - 1)]!;
  const last = step >= steps.length - 1;
  const canNext = cur.kind === 'rules' ? accepted : !cur.q.required || (answers[cur.q.id]?.length ?? 0) > 0;

  const toggle = (q: GuildOnboardingQuestion, id: string) =>
    setAnswers((p) => {
      const had = p[q.id] ?? [];
      return { ...p, [q.id]: had.includes(id) ? had.filter((x) => x !== id) : q.multi ? [...had, id] : [id] };
    });

  const finish = () => {
    setBusy(true);
    setError(null);
    client
      .completeGuildOnboarding(guildId, { acceptRules: accepted || cfg.rules.length === 0, answers })
      .then((r: GuildOnboardingCompleteResult) => {
        setClosed(true);
        const first = r.suggestedChannelIds[0];
        if (first) onSuggestedChannel?.(first);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Kaydedilemedi'))
      .finally(() => setBusy(false));
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => setClosed(true)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">
            {cur.kind === 'rules' ? 'Sunucu kuralları' : cur.q.title}
          </Text>
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
            {cur.kind === 'rules' ? (
              <>
                {cfg.rules.map((r, i) => (
                  <Text key={i} style={styles.body}>
                    {i + 1}. {r}
                  </Text>
                ))}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted(!accepted)}
                  style={[styles.opt, accepted && styles.optOn]}
                >
                  <Text style={styles.optText}>{accepted ? '☑' : '☐'} Kuralları okudum ve kabul ediyorum</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.hint}>{cur.q.multi ? 'Birden fazla seçebilirsin.' : 'Birini seç.'}</Text>
                {cur.q.options.map((o) => {
                  const on = (answers[cur.q.id] ?? []).includes(o.id);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => toggle(cur.q, o.id)}
                      style={[styles.opt, on && styles.optOn]}
                    >
                      <Text style={styles.optText}>
                        {o.emoji ? `${o.emoji}  ` : ''}
                        {o.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            )}
          </ScrollView>
          {error ? <Text style={[styles.body, { color: colors.danger }]}>{error}</Text> : null}
          <View style={styles.row}>
            <Text style={styles.hint}>
              {step + 1} / {steps.length}
            </Text>
            <View style={{ flex: 1 }} />
            {step > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => setStep(step - 1)} style={[styles.btn, { backgroundColor: colors.surfaceHigh }]}>
                <Text style={[styles.btnText, { color: colors.text }]}>Geri</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!canNext || busy}
              onPress={() => (last ? finish() : setStep(step + 1))}
              style={[styles.btn, { backgroundColor: colors.primary, opacity: !canNext || busy ? 0.5 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryOn }]}>{last ? (busy ? '…' : 'Bitir') : 'İleri'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, gap: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.textMuted, fontSize: 13 },
  opt: { borderWidth: 1, borderColor: colors.surfaceHigh, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
  optOn: { borderColor: colors.primary, backgroundColor: colors.surfaceHigh },
  optText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 15 },
});
