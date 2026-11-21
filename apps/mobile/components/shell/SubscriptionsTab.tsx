import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { DracordClient } from '@dracord/sdk';
import type { GuildSubscriptionsOverview } from '@dracord/types';
import { colors } from '@dracord/app-theme';

const until = (iso: string | null) => (iso ? `${new Date(iso).toLocaleDateString('tr-TR')} tarihine kadar` : 'süresiz');

/** F2 — sunucu abonelikleri (mobil): kademeler, ödeme bağlantısı, kod kullan */
export function SubscriptionsTab({ client, guildId }: { client: DracordClient; guildId: string }) {
  const [ov, setOv] = useState<GuildSubscriptionsOverview | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => client.getGuildSubscriptions(guildId).then(setOv), [client, guildId]);
  useEffect(() => {
    void load().catch(() => setOv({ tiers: [], mine: [], canManage: false }));
  }, [load]);

  const redeem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const s = await client.redeemSubscriptionCode(guildId, code);
      setCode('');
      await load();
      const t = ov?.tiers.find((x) => x.id === s.tierId);
      setMsg({ ok: true, text: `${t?.name ?? 'Üyelik'} açıldı — ${until(s.expiresAt)}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kod kullanılamadı' });
    } finally {
      setBusy(false);
    }
  };

  if (!ov) return <Text style={{ color: colors.textMuted, padding: 16 }}>Yükleniyor…</Text>;
  const valid = code.replace(/[^a-z0-9]/gi, '').length >= 12;
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      {ov.tiers.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>
          Bu sunucuda henüz abonelik kademesi yok.{ov.canManage ? ' Kademeleri web ya da masaüstünde sunucu ayarlarından ekleyebilirsin.' : ''}
        </Text>
      ) : null}
      {ov.tiers.map((t) => {
        const mine = ov.mine.find((m) => m.tierId === t.id);
        return (
          <View key={t.id} style={{ borderWidth: 1, borderColor: t.color ?? colors.surfaceHigh, borderRadius: 12, padding: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }} numberOfLines={1}>
                {t.name}
              </Text>
              {t.priceText ? <Text style={{ color: colors.primary, fontWeight: '700' }}>{t.priceText}</Text> : null}
            </View>
            {t.perks ? <Text style={{ color: colors.textMuted }}>{t.perks}</Text> : null}
            {mine ? <Text style={{ color: colors.primary, fontSize: 12 }}>✓ Aktif · {until(mine.expiresAt)}</Text> : null}
            {t.paymentUrl ? (
              <Pressable
                onPress={() => void Linking.openURL(t.paymentUrl!)}
                accessibilityRole="link"
                style={{ alignSelf: 'flex-start', backgroundColor: mine ? colors.surfaceHigh : colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Text style={{ color: mine ? colors.text : colors.bg, fontWeight: '700' }}>{mine ? 'Yenile ↗' : 'Destek ol ↗'}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {ov.tiers.some((t) => t.paymentUrl) ? (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          Ödeme doğrudan sunucu sahibine yapılır; Dracord aracılık etmez. Ödemeden sonra sahibinden üyelik kodu iste.
        </Text>
      ) : null}
      {ov.tiers.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="ABCD-EFGH-JKLM"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            accessibilityLabel="Üyelik kodu"
            style={{ flex: 1, color: colors.text, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontFamily: 'monospace' }}
          />
          <Pressable
            disabled={busy || !valid}
            onPress={() => void redeem()}
            style={{ backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center', opacity: busy || !valid ? 0.5 : 1 }}
          >
            <Text style={{ color: colors.bg, fontWeight: '700' }}>Kullan</Text>
          </Pressable>
        </View>
      ) : null}
      {msg ? <Text style={{ color: msg.ok ? colors.primary : colors.danger }}>{msg.text}</Text> : null}
    </ScrollView>
  );
}
