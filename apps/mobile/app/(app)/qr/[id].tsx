import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../../lib/auth';

type State = 'loading' | 'ask' | 'busy' | 'approved' | 'rejected' | 'error';

/** E4 — opened from the QR on a computer: approve signing that computer in */
export default function QrApproveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ticketId = typeof id === 'string' && /^[a-f0-9]{32}$/.test(id) ? id : null;
  const { client, user } = useAuth();
  const [state, setState] = useState<State>('loading');
  const [device, setDevice] = useState<string | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) {
      setError('Geçersiz QR kodu');
      setState('error');
      return;
    }
    let off = false;
    client
      .scanQrLogin(ticketId)
      .then((r) => {
        if (off) return;
        setDevice(r.device);
        setIp(r.ip);
        setState('ask');
      })
      .catch((e) => {
        if (off) return;
        setError(e instanceof Error ? e.message : 'QR kodu açılamadı');
        setState('error');
      });
    return () => {
      off = true;
    };
  }, [client, ticketId]);

  const decide = (approve: boolean) => {
    if (!ticketId) return;
    setState('busy');
    client
      .decideQrLogin(ticketId, approve)
      .then(() => setState(approve ? 'approved' : 'rejected'))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'İşlem başarısız');
        setState('error');
      });
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {state === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        {state === 'ask' || state === 'busy' ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              Bu cihazda giriş yapılsın mı?
            </Text>
            <Text style={styles.body}>
              <Text style={styles.strong}>{device ?? 'Bilinmeyen cihaz'}</Text>
              {ip ? ` · ${ip}` : ''} cihazı <Text style={styles.strong}>{user?.displayName ?? 'hesabın'}</Text> ile giriş
              yapmak istiyor. Bu kodu sen açmadıysan reddet.
            </Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="button"
                disabled={state === 'busy'}
                onPress={() => decide(false)}
                style={[styles.btn, { backgroundColor: colors.surfaceHigh }]}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>Reddet</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={state === 'busy'}
                onPress={() => decide(true)}
                style={[styles.btn, { backgroundColor: colors.primary, opacity: state === 'busy' ? 0.6 : 1 }]}
              >
                <Text style={[styles.btnText, { color: colors.primaryOn }]}>Girişi onayla</Text>
              </Pressable>
            </View>
          </>
        ) : null}
        {state === 'approved' ? <Text style={styles.body}>Giriş onaylandı. Bilgisayarındaki Dracord açılıyor.</Text> : null}
        {state === 'rejected' ? <Text style={styles.body}>Giriş reddedildi.</Text> : null}
        {state === 'error' ? <Text style={[styles.body, { color: colors.danger }]}>{error}</Text> : null}
        {state === 'approved' || state === 'rejected' || state === 'error' ? (
          <Pressable accessibilityRole="button" onPress={close} style={[styles.btn, { backgroundColor: colors.surfaceHigh, marginTop: 12 }]}>
            <Text style={[styles.btnText, { color: colors.text }]}>Kapat</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 16, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  strong: { color: colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontWeight: '700', fontSize: 15 },
});
