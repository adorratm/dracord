import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { colors } from '@dracord/app-theme';

export type ConfirmRequest = {
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** true → kırmızı onay */
  destructive?: boolean;
  /** Yalnızca Tamam */
  notice?: boolean;
};

type ActiveConfirm = ConfirmRequest & {
  resolve: (ok: boolean) => void;
};

let pending: ActiveConfirm | null = null;
let notify: ((c: ActiveConfirm | null) => void) | null = null;

/** Promise tabanlı onay — Android Alert yerine uygulama stili */
export function confirmDialog(req: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { ...req, resolve };
    notify?.(pending);
  });
}

export function noticeDialog(title: string, message?: string): Promise<void> {
  return confirmDialog({
    title,
    message,
    notice: true,
    confirmLabel: 'Tamam',
  }).then(() => undefined);
}

/** App kökünde bir kez mount et */
export function ConfirmModalHost() {
  const [active, setActive] = useState<ActiveConfirm | null>(null);

  useEffect(() => {
    notify = setActive;
    if (pending) setActive(pending);
    return () => {
      if (notify === setActive) notify = null;
    };
  }, []);

  if (!active) return null;

  const close = (ok: boolean) => {
    active.resolve(ok);
    pending = null;
    setActive(null);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={() => close(false)}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: 28,
        }}
        onPress={() => close(false)}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.surfaceHigh,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17 }}>
            {active.title}
          </Text>
          {active.message ? (
            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
              {active.message}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            {!active.notice ? (
              <Pressable
                onPress={() => close(false)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceHigh,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>
                  {active.cancelLabel ?? 'İptal'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => close(true)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 12,
                backgroundColor: active.destructive ? colors.danger : colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: active.destructive ? '#fff' : colors.primaryOn,
                  fontWeight: '700',
                }}
              >
                {active.confirmLabel ?? (active.notice ? 'Tamam' : 'Onayla')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
