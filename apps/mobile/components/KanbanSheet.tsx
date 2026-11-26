import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { KanbanBoardDto, KanbanCardDto } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { Icon } from './Icon';

const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** D5 — kanal görev panosu (mobil): sütun sekmeleri, kart listesi, dokun → taşı/sil */
export function KanbanSheet({ channelId, open, onClose }: { channelId: string; open: boolean; onClose: () => void }) {
  const { client, user } = useAuth();
  const [board, setBoard] = useState<KanbanBoardDto | null>(null);
  const [col, setCol] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState<KanbanCardDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    void client
      .getKanban(channelId)
      .then((b) => {
        if (!alive) return;
        setBoard(b);
        setCol((c) => c ?? [...b.columns].sort(byPos)[0]?.id ?? null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Pano yüklenemedi'));
    const off = client.onKanbanEvent((e) => {
      if (e.channelId !== channelId) return;
      setBoard((b) => {
        if (!b) return b;
        if (e.kind === 'card') {
          const has = b.cards.some((c) => c.id === e.card.id);
          return { ...b, cards: has ? b.cards.map((c) => (c.id === e.card.id ? e.card : c)) : [...b.cards, e.card] };
        }
        if (e.kind === 'cardRemoved') return { ...b, cards: b.cards.filter((c) => c.id !== e.id) };
        if (e.kind === 'column') {
          const has = b.columns.some((c) => c.id === e.column.id);
          return { ...b, columns: has ? b.columns.map((c) => (c.id === e.column.id ? e.column : c)) : [...b.columns, e.column] };
        }
        return { ...b, columns: b.columns.filter((c) => c.id !== e.id) };
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [client, channelId, open]);

  const columns = useMemo(() => (board ? [...board.columns].sort(byPos) : []), [board]);
  const activeCol = columns.find((c) => c.id === col) ?? columns[0];
  const cards = useMemo(
    () => (board && activeCol ? board.cards.filter((c) => c.columnId === activeCol.id).sort(byPos) : []),
    [board, activeCol],
  );

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'İşlem başarısız');

  const add = () => {
    const title = draft.trim();
    if (!title || !activeCol) return;
    setDraft('');
    void client
      .createKanbanCard(channelId, { columnId: activeCol.id, title })
      .then((c) => setBoard((b) => (b && !b.cards.some((x) => x.id === c.id) ? { ...b, cards: [...b.cards, c] } : b)))
      .catch(fail);
  };

  const moveTo = (card: KanbanCardDto, columnId: string) => {
    setPicked(null);
    const last = board?.cards.filter((c) => c.columnId === columnId).sort(byPos).at(-1)?.position ?? 0;
    setBoard((b) => (b ? { ...b, cards: b.cards.map((c) => (c.id === card.id ? { ...c, columnId, position: last + 1 } : c)) } : b));
    void client.updateKanbanCard(channelId, card.id, { columnId, position: last + 1 }).catch(fail);
  };

  const remove = (card: KanbanCardDto) => {
    setPicked(null);
    Alert.alert('Kart silinsin mi?', card.title, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setBoard((b) => (b ? { ...b, cards: b.cards.filter((c) => c.id !== card.id) } : b));
          void client.deleteKanbanCard(channelId, card.id).catch(fail);
        },
      },
    ]);
  };

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={st.root}>
        <View style={st.head}>
          <Text style={st.title}>Görev panosu</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={12}>
            <Icon name="close" size={24} />
          </Pressable>
        </View>
        {error ? (
          <Text style={st.error} onPress={() => setError(null)}>
            {error}
          </Text>
        ) : null}
        <View style={st.tabs}>
          {columns.map((c) => {
            const n = board?.cards.filter((x) => x.columnId === c.id).length ?? 0;
            const on = c.id === activeCol?.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCol(c.id)}
                style={[st.tab, on && st.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[st.tabText, on && { color: colors.primaryOn }]}>
                  {c.name} · {n}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <FlatList
          data={cards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          ListEmptyComponent={<Text style={st.muted}>{board ? 'Bu sütunda kart yok.' : 'Yükleniyor…'}</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setPicked(item)} style={st.card} accessibilityRole="button" accessibilityHint="Taşı veya sil">
              {item.labels.length ? <Text style={st.labels}>{item.labels.map((l) => `#${l}`).join('  ')}</Text> : null}
              <Text style={st.cardTitle}>{item.title}</Text>
              {item.dueAt || item.assigneeIds.length ? (
                <Text style={st.muted}>
                  {item.dueAt ? `📅 ${new Date(item.dueAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}  ` : ''}
                  {item.assigneeIds.length ? `👤 ${item.assigneeIds.length}` : ''}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
        <View style={st.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={activeCol ? `${activeCol.name} sütununa kart ekle…` : 'Kart ekle…'}
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            onSubmitEditing={add}
            returnKeyType="done"
            style={st.input}
          />
          <Pressable onPress={add} style={st.addBtn} accessibilityRole="button" accessibilityLabel="Kart ekle">
            <Icon name="add" size={22} color={colors.primaryOn} />
          </Pressable>
        </View>
      </View>
      <Modal visible={!!picked} transparent animationType="fade" onRequestClose={() => setPicked(null)}>
        <Pressable style={st.backdrop} onPress={() => setPicked(null)}>
          <View style={st.sheet}>
            <Text style={st.cardTitle}>{picked?.title}</Text>
            {picked?.description ? <Text style={[st.muted, { marginTop: 6 }]}>{picked.description}</Text> : null}
            <Text style={[st.muted, { marginTop: 12 }]}>Taşı:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {columns
                .filter((c) => c.id !== picked?.columnId)
                .map((c) => (
                  <Pressable key={c.id} onPress={() => picked && moveTo(picked, c.id)} style={st.tab} accessibilityRole="button">
                    <Text style={st.tabText}>→ {c.name}</Text>
                  </Pressable>
                ))}
            </View>
            {picked && (picked.createdBy === user?.id || board?.canManage) ? (
              <Pressable onPress={() => remove(picked)} style={{ marginTop: 16 }} accessibilityRole="button">
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Kartı sil</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: 48 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  error: { color: colors.danger, paddingHorizontal: 16, paddingBottom: 6 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12 },
  tab: { backgroundColor: colors.surfaceHigh, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  tabOn: { backgroundColor: colors.primary },
  tabText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 12 },
  cardTitle: { color: colors.text, fontSize: 15 },
  labels: { color: colors.primary, fontSize: 12, marginBottom: 4 },
  muted: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  addRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  input: { flex: 1, backgroundColor: colors.surfaceHigh, color: colors.text, borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  addBtn: { backgroundColor: colors.primary, borderRadius: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 },
});
