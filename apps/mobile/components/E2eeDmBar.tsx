import { Pressable, Text, View } from 'react-native';
import { colors } from '@dracord/app-theme';
import type { MobileE2eeController } from '../lib/e2ee';
import { confirmDialog } from './ConfirmModal';
import { Icon } from './Icon';

const ENABLE_NOTES = [
  '• Yeni mesajlar cihazlarınızda şifrelenir; Dracord sunucusu içeriği göremez.',
  '• Bu sohbette şimdilik yalnız metin gönderilebilir (dosya, ses kaydı, GIF, sticker ve zamanlama kapalı).',
  '• Şifreli mesajlar aranamaz, düzenlenemez ve şikâyet edilirken içerik sunucuya gönderilmez.',
  '• Sonradan eklediğin yeni bir cihaz, eklenmeden önceki şifreli mesajları okuyamaz.',
  '• Eski uygulama sürümleri bu sohbete mesaj gönderemez; güncellemeleri gerekir.',
].join('\n');

/** E3 — DM üstünde şifreleme durumu, aç/kapat, güvenlik kodu, cihaz değişikliği uyarısı */
export function E2eeDmBar({ ctl, peerName }: { ctl: MobileE2eeController; peerName: string }) {
  if (!ctl.info && !ctl.error) return null;

  const showCode = async () => {
    const changed = ctl.devicesChanged;
    const ok = await confirmDialog({
      title: 'Güvenlik kodu',
      message: `${peerName} ile bu kodu yüz yüze ya da başka bir yoldan karşılaştırın. Aynıysa aranızda kimse yok demektir. Biri yeni cihaz eklediğinde kod değişir.\n\n${ctl.safetyNumber ?? '—'}`,
      notice: !changed,
      confirmLabel: changed ? 'Doğruladım' : 'Tamam',
      cancelLabel: 'Kapat',
    });
    if (ok && changed) ctl.acknowledgeDevices();
  };

  const toggle = async () => {
    const on = !ctl.enabled;
    const ok = await confirmDialog({
      title: on ? 'Uçtan uca şifreleme' : 'Şifrelemeyi kapat',
      message: on
        ? ENABLE_NOTES
        : 'Bundan sonraki mesajlar şifresiz gönderilir. Önceki şifreli mesajlar şifreli kalır.',
      confirmLabel: on ? 'Aç' : 'Kapat',
      destructive: !on,
    });
    if (ok) await ctl.setEnabled(on);
  };

  return (
    <View>
      {ctl.info ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: ctl.enabled ? `${colors.primary}1a` : 'transparent',
            borderBottomWidth: 1,
            borderBottomColor: colors.surfaceHigh,
          }}
        >
          <Icon name={ctl.enabled ? 'lock' : 'lock_open'} size={16} color={ctl.enabled ? colors.primary : colors.textMuted} />
          <Text style={{ flex: 1, fontSize: 12, color: ctl.enabled ? colors.text : colors.textMuted }} numberOfLines={2}>
            {ctl.enabled ? 'Uçtan uca şifreli' : 'Uçtan uca şifreleme kapalı'}
          </Text>
          {ctl.enabled ? (
            <Pressable onPress={() => void showCode()} hitSlop={6} accessibilityRole="button">
              <Text style={{ fontSize: 12, color: colors.textMuted }}>Güvenlik kodu</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={ctl.busy || !ctl.supported}
            onPress={() => void toggle()}
            hitSlop={6}
            accessibilityRole="button"
            style={{ opacity: ctl.busy || !ctl.supported ? 0.5 : 1 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
              {ctl.enabled ? 'Kapat' : 'Şifrele'}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {ctl.error ? (
        <Text style={{ paddingHorizontal: 12, paddingVertical: 4, fontSize: 12, color: colors.danger }}>{ctl.error}</Text>
      ) : null}
      {ctl.enabled && ctl.devicesChanged ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: `${colors.danger}1a`,
          }}
        >
          <Icon name="warning" size={16} color={colors.danger} />
          <Text style={{ flex: 1, fontSize: 12, color: colors.text }}>
            {peerName} cihazlarını değiştirdi. Güvenlik kodu değişti.
          </Text>
          <Pressable onPress={() => void showCode()} hitSlop={6}>
            <Text style={{ fontSize: 12, color: colors.primary }}>Kodu gör</Text>
          </Pressable>
          <Pressable onPress={ctl.acknowledgeDevices} hitSlop={6}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>Tamam</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
