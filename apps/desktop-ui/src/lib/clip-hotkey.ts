/**
 * Ctrl+Shift+K paylaşımı (C7): paylaşım klibi ve bağımsız klip aynı kısayolu kullanır.
 * Kısayol, en son açılan arabelleğe gider; hepsi kapanınca main'de kayıt silinir.
 */
type Fn = () => void;
const owners = new Map<string, Fn>();
let unsub: (() => void) | null = null;

function api() {
  return typeof window !== 'undefined' ? window.dracordDesktop : undefined;
}

export async function armClipHotkey(owner: string, fn: Fn): Promise<string | null> {
  owners.delete(owner);
  owners.set(owner, fn);
  if (!unsub) {
    unsub =
      api()?.onClipHotkey?.(() => {
        const last = [...owners.values()].pop();
        last?.();
      }) ?? null;
  }
  const r = await api()?.setClipArmed?.(true);
  return r?.accelerator ?? null;
}

export function disarmClipHotkey(owner: string) {
  if (!owners.delete(owner)) return;
  if (owners.size === 0) {
    void api()?.setClipArmed?.(false);
    unsub?.();
    unsub = null;
  }
}
