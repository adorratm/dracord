'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  KanbanBoardDto,
  KanbanCardDto,
  KanbanCardInput,
  KanbanColumnDto,
  KanbanEvent,
  PublicUser,
} from '@dracord/types';
import { Avatar } from './Avatar';

export type KanbanClient = {
  connectSocket(): unknown;
  joinChannel(channelId: string): void;
  getKanban(channelId: string): Promise<KanbanBoardDto>;
  createKanbanCard(channelId: string, input: KanbanCardInput): Promise<KanbanCardDto>;
  updateKanbanCard(channelId: string, cardId: string, input: KanbanCardInput): Promise<KanbanCardDto>;
  deleteKanbanCard(channelId: string, cardId: string): Promise<unknown>;
  saveKanbanColumn(channelId: string, input: { id?: string; name?: string; color?: string | null; position?: number }): Promise<KanbanColumnDto>;
  deleteKanbanColumn(channelId: string, columnId: string): Promise<unknown>;
  onKanbanEvent(handler: (e: KanbanEvent) => void): () => void;
};

export interface KanbanBoardProps {
  client: KanbanClient;
  channelId: string;
  meId: string;
  /** atama ve avatar için (sunucu üyeleri / DM katılımcıları) */
  members?: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>[];
  /** kartı açan dışındakileri silebilir mi (Mesajları yönet) */
  canModerate?: boolean;
  className?: string;
}

const LABEL_COLORS = ['#ff79c6', '#8be9fd', '#50fa7b', '#ffb86c', '#bd93f9', '#f1fa8c', '#ff5555'];
function labelColor(l: string): string {
  let h = 0;
  for (const ch of l) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length]!;
}

const byPos = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** hedef indeksine göre yeni sıra değeri (komşuların ortası) */
export function positionAt(list: { position: number }[], index: number): number {
  const prev = list[index - 1]?.position;
  const next = list[index]?.position;
  if (prev === undefined && next === undefined) return 1;
  if (prev === undefined) return next! - 1;
  if (next === undefined) return prev + 1;
  return (prev + next) / 2;
}

function dueInfo(iso: string | null): { text: string; late: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return {
    text: d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    late: days < 0,
  };
}

/**
 * D5 — kanal panosu (web + desktop): sütunlar, kartlar, sürükle-bırak, atama, etiket, son tarih.
 * Gerçek zamanlı: başka biri kart taşıyınca anında görünür.
 */
export function KanbanBoard({ client, channelId, meId, members = [], canModerate = false, className }: KanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoardDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ col: string; index: number } | null>(null);
  const [editing, setEditing] = useState<KanbanCardDto | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  useEffect(() => {
    let alive = true;
    client.connectSocket();
    client.joinChannel(channelId);
    setBoard(null);
    client
      .getKanban(channelId)
      .then((b) => alive && setBoard(b))
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
  }, [client, channelId]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : 'İşlem başarısız');

  /** iyimser güncelleme + sunucu */
  const patchCard = useCallback(
    (card: KanbanCardDto, input: KanbanCardInput) => {
      setBoard((b) => (b ? { ...b, cards: b.cards.map((c) => (c.id === card.id ? { ...c, ...input, description: input.description ?? c.description, dueAt: input.dueAt === undefined ? c.dueAt : input.dueAt } as KanbanCardDto : c)) } : b));
      void client.updateKanbanCard(channelId, card.id, input).catch((e) => {
        fail(e);
        void client.getKanban(channelId).then(setBoard).catch(() => undefined);
      });
    },
    [client, channelId],
  );

  if (error && !board) return <p className="p-space-md font-body-sm text-error">{error}</p>;
  if (!board) return <div className="h-full animate-pulse rounded-xl bg-surface-container-high" />;

  const columns = [...board.columns].sort(byPos);
  const cardsIn = (colId: string) =>
    board.cards
      .filter((c) => c.columnId === colId && (filter === 'all' || c.assigneeIds.includes(meId) || (c.createdBy === meId && !c.assigneeIds.length)))
      .sort(byPos);

  const dropOn = (colId: string, index: number) => {
    const card = board.cards.find((c) => c.id === drag);
    setDrag(null);
    setOver(null);
    if (!card) return;
    const list = cardsIn(colId).filter((c) => c.id !== card.id);
    patchCard(card, { columnId: colId, position: positionAt(list, Math.min(index, list.length)) });
  };

  const addCard = (colId: string) => {
    const title = draft.trim();
    if (!title) return setAdding(null);
    setDraft('');
    void client
      .createKanbanCard(channelId, { columnId: colId, title })
      .then((c) => setBoard((b) => (b && !b.cards.some((x) => x.id === c.id) ? { ...b, cards: [...b.cards, c] } : b)))
      .catch(fail);
  };

  const addColumn = () => {
    const name = window.prompt('Sütun adı');
    if (!name?.trim()) return;
    void client.saveKanbanColumn(channelId, { name: name.trim() }).catch(fail);
  };

  const renameColumn = (c: KanbanColumnDto) => {
    const name = window.prompt('Sütunun yeni adı', c.name);
    if (!name?.trim() || name.trim() === c.name) return;
    void client.saveKanbanColumn(channelId, { id: c.id, name: name.trim() }).catch(fail);
  };

  const removeColumn = (c: KanbanColumnDto) => {
    if (!window.confirm(`"${c.name}" sütunu silinsin mi? İçindeki kartlar yandaki sütuna taşınır.`)) return;
    void client.deleteKanbanColumn(channelId, c.id).catch(fail);
  };

  const moveColumn = (c: KanbanColumnDto, dir: -1 | 1) => {
    const i = columns.findIndex((x) => x.id === c.id);
    const others = columns.filter((x) => x.id !== c.id);
    const target = Math.max(0, Math.min(others.length, i + dir));
    void client.saveKanbanColumn(channelId, { id: c.id, position: positionAt(others, target) }).catch(fail);
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${className ?? ''}`}>
      <div className="mb-space-sm flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-container-high p-0.5 font-label-sm">
          {(['all', 'mine'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 ${filter === f ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {f === 'all' ? 'Tüm kartlar' : 'Benim kartlarım'}
            </button>
          ))}
        </div>
        <span className="font-body-sm text-on-surface-variant">{board.cards.length} kart</span>
        {board.canManage && (
          <button type="button" onClick={addColumn} className="ml-auto rounded-lg bg-surface-container-high px-3 py-1 font-label-sm text-on-surface hover:bg-surface-container-highest">
            + Sütun
          </button>
        )}
      </div>
      {error && (
        <p className="mb-space-sm font-body-sm text-error" role="alert">
          {error}{' '}
          <button type="button" className="underline" onClick={() => setError(null)}>
            Kapat
          </button>
        </p>
      )}
      <div className="flex min-h-0 flex-1 gap-space-sm overflow-x-auto pb-2">
        {columns.map((col, ci) => {
          const list = cardsIn(col.id);
          return (
            <section
              key={col.id}
              aria-label={col.name}
              className={`flex w-72 shrink-0 flex-col rounded-xl bg-surface-container p-2 ${over?.col === col.id ? 'ring-2 ring-primary/60' : ''}`}
              onDragOver={(e) => {
                if (!drag) return;
                e.preventDefault();
                if (over?.col !== col.id) setOver({ col: col.id, index: list.length });
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(col.id, over?.col === col.id ? over.index : list.length);
              }}
            >
              <header className="mb-2 flex items-center gap-1 px-1">
                {col.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} /> : null}
                <h3 className="min-w-0 flex-1 truncate font-label-md text-on-surface">{col.name}</h3>
                <span className="font-label-sm text-on-surface-variant">{list.length}</span>
                {board.canManage && (
                  <span className="flex">
                    <button type="button" title="Sola taşı" aria-label="Sütunu sola taşı" disabled={ci === 0} onClick={() => moveColumn(col, -1)} className="rounded px-1 text-outline hover:text-on-surface disabled:opacity-30">
                      ‹
                    </button>
                    <button type="button" title="Sağa taşı" aria-label="Sütunu sağa taşı" disabled={ci === columns.length - 1} onClick={() => moveColumn(col, 1)} className="rounded px-1 text-outline hover:text-on-surface disabled:opacity-30">
                      ›
                    </button>
                    <button type="button" title="Yeniden adlandır" aria-label="Sütunu yeniden adlandır" onClick={() => renameColumn(col)} className="rounded px-1 text-outline hover:text-on-surface">
                      ✎
                    </button>
                    {columns.length > 1 && (
                      <button type="button" title="Sil" aria-label="Sütunu sil" onClick={() => removeColumn(col)} className="rounded px-1 text-outline hover:text-error">
                        ×
                      </button>
                    )}
                  </span>
                )}
              </header>
              <ol className="flex min-h-[3rem] flex-1 flex-col gap-2 overflow-y-auto">
                {list.map((card, i) => {
                  const due = dueInfo(card.dueAt);
                  return (
                    <li
                      key={card.id}
                      draggable
                      onDragStart={(e) => {
                        setDrag(card.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', card.title);
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setOver(null);
                      }}
                      onDragOver={(e) => {
                        if (!drag) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const idx = e.clientY < r.top + r.height / 2 ? i : i + 1;
                        if (over?.col !== col.id || over.index !== idx) setOver({ col: col.id, index: idx });
                      }}
                      className={`relative ${drag === card.id ? 'opacity-40' : ''}`}
                    >
                      {over?.col === col.id && over.index === i && drag && drag !== card.id ? <div className="absolute -top-1.5 left-0 right-0 h-0.5 rounded bg-primary" /> : null}
                      <button
                        type="button"
                        onClick={() => setEditing(card)}
                        className="w-full cursor-grab rounded-lg bg-surface-container-high p-2.5 text-left shadow-sm hover:bg-surface-container-highest active:cursor-grabbing"
                      >
                        {card.labels.length ? (
                          <span className="mb-1.5 flex flex-wrap gap-1">
                            {card.labels.map((l) => (
                              <span key={l} className="rounded px-1.5 py-px font-label-sm text-[11px] text-[#11131e]" style={{ background: labelColor(l) }}>
                                {l}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        <span className="block whitespace-pre-wrap break-words font-body-sm text-on-surface">{card.title}</span>
                        {(due || card.assigneeIds.length || card.description) && (
                          <span className="mt-2 flex items-center gap-2 font-label-sm text-on-surface-variant">
                            {due ? <span className={due.late && ci !== columns.length - 1 ? 'text-error' : ''}>📅 {due.text}</span> : null}
                            {card.description ? <span title="Açıklama var">≡</span> : null}
                            <span className="ml-auto flex -space-x-1.5">
                              {card.assigneeIds.slice(0, 3).map((id) => {
                                const m = memberById.get(id);
                                return (
                                  <span key={id} title={m?.displayName || m?.username || 'Üye'}>
                                    <Avatar imageUrl={m?.avatarUrl ?? null} displayName={m?.displayName || m?.username || '?'} size="sm" />
                                  </span>
                                );
                              })}
                            </span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
                {over?.col === col.id && over.index >= list.length && drag ? <li className="h-0.5 rounded bg-primary" aria-hidden /> : null}
              </ol>
              {adding === col.id ? (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addCard(col.id);
                  }}
                >
                  <textarea
                    autoFocus
                    value={draft}
                    maxLength={200}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addCard(col.id);
                      } else if (e.key === 'Escape') setAdding(null);
                    }}
                    placeholder="Kart başlığı…"
                    className="h-16 w-full resize-none rounded-lg bg-surface-container-highest p-2 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="mt-1 flex gap-2">
                    <button type="submit" className="rounded-lg bg-primary px-3 py-1 font-label-sm text-on-primary">
                      Ekle
                    </button>
                    <button type="button" onClick={() => setAdding(null)} className="rounded-lg px-3 py-1 font-label-sm text-on-surface-variant">
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(col.id);
                    setDraft('');
                  }}
                  className="mt-2 rounded-lg px-2 py-1.5 text-left font-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  + Kart ekle
                </button>
              )}
            </section>
          );
        })}
      </div>
      {editing && (
        <CardEditor
          card={board.cards.find((c) => c.id === editing.id) ?? editing}
          columns={columns}
          members={members}
          canDelete={editing.createdBy === meId || canModerate}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            patchCard(editing, input);
            setEditing(null);
          }}
          onDelete={() => {
            const id = editing.id;
            setEditing(null);
            setBoard((b) => (b ? { ...b, cards: b.cards.filter((c) => c.id !== id) } : b));
            void client.deleteKanbanCard(channelId, id).catch(fail);
          }}
        />
      )}
    </div>
  );
}

function CardEditor({
  card,
  columns,
  members,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: {
  card: KanbanCardDto;
  columns: KanbanColumnDto[];
  members: Pick<PublicUser, 'id' | 'username' | 'displayName' | 'avatarUrl'>[];
  canDelete: boolean;
  onClose: () => void;
  onSave: (input: KanbanCardInput) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [labels, setLabels] = useState(card.labels.join(', '));
  const [due, setDue] = useState(card.dueAt ? card.dueAt.slice(0, 10) : '');
  const [columnId, setColumnId] = useState(card.columnId);
  const [assignees, setAssignees] = useState<string[]>(card.assigneeIds);
  const [q, setQ] = useState('');

  const picks = members
    .filter((m) => !assignees.includes(m.id) && (`${m.displayName} ${m.username}`.toLowerCase().includes(q.toLowerCase())))
    .slice(0, 6);

  const save = () => {
    const input: KanbanCardInput = {};
    if (title.trim() && title.trim() !== card.title) input.title = title.trim();
    if ((description.trim() || null) !== card.description) input.description = description.trim() || null;
    const ls = labels.split(',').map((l) => l.trim()).filter(Boolean);
    if (ls.join('\u0000') !== card.labels.join('\u0000')) input.labels = ls;
    const dueIso = due ? new Date(`${due}T12:00:00`).toISOString() : null;
    if ((dueIso?.slice(0, 10) ?? null) !== (card.dueAt?.slice(0, 10) ?? null)) input.dueAt = dueIso;
    if (columnId !== card.columnId) input.columnId = columnId;
    if (assignees.join() !== card.assigneeIds.join()) input.assigneeIds = assignees;
    if (Object.keys(input).length) onSave(input);
    else onClose();
  };

  const field = 'w-full rounded-lg bg-surface-container-highest px-2.5 py-2 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Kartı düzenle" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container p-space-md shadow-xl" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} aria-label="Başlık" className={`${field} font-headline-sm`} />
        <label className="mt-space-sm block font-label-sm text-on-surface-variant">
          Açıklama
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} className={`${field} mt-1 resize-y`} />
        </label>
        <div className="mt-space-sm grid grid-cols-2 gap-space-sm">
          <label className="block font-label-sm text-on-surface-variant">
            Sütun
            <select value={columnId} onChange={(e) => setColumnId(e.target.value)} className={`${field} mt-1`}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-label-sm text-on-surface-variant">
            Son tarih
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${field} mt-1`} />
          </label>
        </div>
        <label className="mt-space-sm block font-label-sm text-on-surface-variant">
          Etiketler (virgülle, en fazla 6)
          <input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="tasarım, acil" className={`${field} mt-1`} />
        </label>
        <div className="mt-space-sm font-label-sm text-on-surface-variant">
          Atananlar (en fazla 5)
          <div className="mt-1 flex flex-wrap gap-1.5">
            {assignees.map((id) => {
              const m = members.find((x) => x.id === id);
              return (
                <button key={id} type="button" onClick={() => setAssignees((a) => a.filter((x) => x !== id))} className="flex items-center gap-1 rounded-full bg-surface-container-highest py-0.5 pl-0.5 pr-2 text-on-surface" title="Kaldır">
                  <Avatar imageUrl={m?.avatarUrl ?? null} displayName={m?.displayName || m?.username || '?'} size="sm" />
                  {m?.displayName || m?.username || 'Üye'} ×
                </button>
              );
            })}
          </div>
          {assignees.length < 5 && members.length > 0 && (
            <>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Üye ara…" className={`${field} mt-1`} />
              <div className="mt-1 flex flex-wrap gap-1.5">
                {picks.map((m) => (
                  <button key={m.id} type="button" onClick={() => setAssignees((a) => [...a, m.id])} className="flex items-center gap-1 rounded-full bg-surface-container-high py-0.5 pl-0.5 pr-2 text-on-surface hover:bg-surface-container-highest">
                    <Avatar imageUrl={m.avatarUrl} displayName={m.displayName || m.username} size="sm" />
                    {m.displayName || m.username}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="mt-space-md flex items-center gap-2">
          {canDelete && (
            <button type="button" onClick={() => window.confirm('Kart silinsin mi?') && onDelete()} className="rounded-lg px-3 py-2 font-label-md text-error hover:bg-error/10">
              Sil
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto rounded-lg px-3 py-2 font-label-md text-on-surface-variant">
            Vazgeç
          </button>
          <button type="button" onClick={save} disabled={!title.trim()} className="rounded-lg bg-primary px-4 py-2 font-label-md text-on-primary disabled:opacity-50">
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
