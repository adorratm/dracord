import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  DISCOVER_CATEGORIES,
  DISCOVER_CURATED_APPS,
  type DiscoverCategory,
  type DiscoverCuratedApp,
  type GuildSummary,
} from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../../lib/auth';
import { guildBannerUrl, resolveMediaUrl } from '../../lib/mediaUrl';
import { ShellHeader, useAppShellOptional } from '../../components/shell/AppShell';
import { Icon } from '../../components/Icon';
import { primaryBtn, primaryBtnText } from '../../lib/ui';

type DiscoverView = 'servers' | 'apps';

type CuratedApp = DiscoverCuratedApp;

const CURATED_APPS = DISCOVER_CURATED_APPS;

const SERVER_CATEGORIES = [
  { id: 'all' as const, label: 'Ana Sayfa' },
  ...DISCOVER_CATEGORIES,
];

function formatCount(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}

export default function DiscoverScreen() {
  const { client } = useAuth();
  const router = useRouter();
  const shell = useAppShellOptional();
  const [view, setView] = useState<DiscoverView>('servers');
  const [list, setList] = useState<GuildSummary[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof SERVER_CATEGORIES)[number]['id']>('all');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<CuratedApp | null>(null);
  const [addedApps, setAddedApps] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const cat = category === 'all' ? undefined : (category as DiscoverCategory);
      const data = await client.discoverGuilds(query.trim() || undefined, cat);
      setList(data);
      setError(null);
    } catch (e) {
      setList([]);
      setError(e instanceof Error ? e.message : 'Keşfet yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [client, query, category]);

  useEffect(() => {
    if (view !== 'servers') return;
    const t = setTimeout(() => void loadServers(), 150);
    return () => clearTimeout(t);
  }, [loadServers, view]);

  const filteredApps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CURATED_APPS;
    return CURATED_APPS.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q),
    );
  }, [query]);

  const joinServer = async (g: GuildSummary) => {
    setBusyId(g.id);
    setError(null);
    try {
      const joined = await client.joinDiscoverableGuild(g.id);
      await shell?.reloadGuilds?.();
      await shell?.selectGuild?.(joined.id, { openFirst: true });
      router.replace('/(app)/guilds');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Katılınamadı');
    } finally {
      setBusyId(null);
    }
  };

  const launchApp = async (app: CuratedApp) => {
    setError(null);
    setBusyId(app.id);
    try {
      let guilds = shell?.guilds ?? [];
      if (!guilds.length) {
        guilds = await client.listGuilds();
      }
      const g = guilds[0];
      if (!g) {
        setError('Önce bir sunucuya katıl veya oluştur.');
        return;
      }
      await shell?.selectGuild?.(g.id, { openFirst: false });
      const chs = await client.getGuildChannels(g.id);
      const hint = app.gameChannelHint;
      const target =
        (hint
          ? chs.find(
              (c) =>
                c.type === 'GAME' &&
                (c.gameKind ?? '').toLowerCase().includes(hint),
            )
          : undefined) ??
        chs.find((c) => c.type === (app.id === 'watch' ? 'WATCH_PARTY' : 'GAME')) ??
        chs.find((c) => c.type === 'GAME' || c.type === 'WATCH_PARTY') ??
        chs.find((c) => c.type === 'VOICE') ??
        chs.find((c) => c.type === 'TEXT');
      if (!target) {
        setError('Uygun kanal bulunamadı.');
        return;
      }
      setSelectedApp(null);
      if (shell?.openChannel) {
        await shell.openChannel(target, g.id);
      } else if (target.type === 'VOICE') {
        router.push(`/(app)/voice/${g.id}/${target.id}`);
      } else if (target.type === 'GAME' || target.type === 'WATCH_PARTY') {
        router.push(`/(app)/activity/${g.id}/${target.id}`);
      } else {
        router.push(`/(app)/channels/${g.id}/${target.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Açılamadı');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ShellHeader title="Keşfet" />

      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 4,
        }}
      >
        {(['servers', 'apps'] as const).map((v) => {
          const active = view === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                setView(v);
                setSelectedApp(null);
                setError(null);
              }}
              style={{
                height: 34,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: active ? colors.surfaceHigh : 'transparent',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: active ? colors.text : colors.textMuted,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {v === 'servers' ? 'Sunucular' : 'Aktiviteler'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingBottom: 8,
          gap: 8,
        }}
      >
        {view === 'servers' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, alignItems: 'center', paddingRight: 4 }}
            style={{ flex: 1 }}
          >
            {SERVER_CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={{
                    height: 32,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: active ? colors.surfaceHigh : colors.surface,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.text : colors.textMuted,
                      fontWeight: '600',
                      fontSize: 12,
                    }}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 36,
            minWidth: 120,
            maxWidth: 160,
            borderRadius: 10,
            backgroundColor: colors.surfaceHigh,
            paddingHorizontal: 8,
            gap: 4,
          }}
        >
          <Icon name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ara"
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 13, padding: 0 }}
          />
        </View>
      </View>

      {error ? (
        <Text style={{ color: colors.danger, paddingHorizontal: 16, paddingBottom: 8 }}>
          {error}
        </Text>
      ) : null}

      {view === 'servers' ? (
        <FlatList
          data={list}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 12 }}
          ListHeaderComponent={
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: colors.surface,
                padding: 18,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: colors.surfaceHigh,
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
                DRACORD
              </Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22, marginTop: 6 }}>
                Topluluğunu bul
              </Text>
              <Text style={{ color: colors.textMuted, marginTop: 6, lineHeight: 18 }}>
                Oyun, müzik ve eğitim — senin için bir sunucu var.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              {loading ? 'Yükleniyor…' : query.trim() ? 'Sonuç yok' : 'Keşfedilecek sunucu yok'}
            </Text>
          }
          renderItem={({ item: g }) => {
            const members = g.memberCount ?? 0;
            const catLabel =
              DISCOVER_CATEGORIES.find((c) => c.id === g.discoverCategory)?.label ?? 'Oyun';
            return (
              <Pressable
                disabled={busyId === g.id}
                onPress={() => void joinServer(g)}
                style={{
                  borderRadius: 12,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                  opacity: busyId === g.id ? 0.6 : 1,
                }}
              >
                <View style={{ height: 88, backgroundColor: colors.surfaceHigh }}>
                  <Image
                    source={{ uri: guildBannerUrl(g.bannerUrl) }}
                    style={{ height: 88, width: '100%' }}
                    resizeMode="cover"
                  />
                  {g.iconUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(g.iconUrl) ?? undefined }}
                      style={{
                        position: 'absolute',
                        left: 12,
                        bottom: -16,
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: colors.surface,
                        borderWidth: 3,
                        borderColor: colors.surface,
                      }}
                    />
                  ) : null}
                </View>
                <View style={{ padding: 12, paddingTop: 22 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                    {catLabel} · {formatCount(members)} üye
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 12, paddingTop: 4, gap: 12 }}>
          <View
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              backgroundColor: colors.surface,
              padding: 18,
              borderWidth: 1,
              borderColor: colors.surfaceHigh,
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}>
              DRACORD
            </Text>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 22, marginTop: 6 }}>
              Aktivite kısayolları
            </Text>
            <Text style={{ color: colors.textMuted, marginTop: 6, lineHeight: 18 }}>
              Yerleşik oyun / watch party kısayolları — sunucu mağazası değil; mevcut sunucundaki kanallara gider.
            </Text>
          </View>

          {filteredApps.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              Uygulama bulunamadı
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {filteredApps.map((app) => (
                <Pressable
                  key={app.id}
                  onPress={() => setSelectedApp(app)}
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: colors.surface,
                    borderWidth: selectedApp?.id === app.id ? 1.5 : 1,
                    borderColor:
                      selectedApp?.id === app.id ? colors.primary : colors.surfaceHigh,
                    flexDirection: 'row',
                    minHeight: 88,
                  }}
                >
                  <View
                    style={{
                      width: 88,
                      backgroundColor: app.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name={app.icon} size={32} color="#fff" />
                  </View>
                  <View style={{ flex: 1, padding: 12, justifyContent: 'center' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{app.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {app.tagline}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selectedApp)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedApp(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          onPress={() => setSelectedApp(null)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              paddingBottom: 28,
              gap: 12,
            }}
          >
            {selectedApp ? (
              <>
                <View
                  style={{
                    height: 96,
                    borderRadius: 12,
                    backgroundColor: selectedApp.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name={selectedApp.icon} size={40} color="#fff" />
                </View>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 20 }}>
                  {selectedApp.name}
                </Text>
                <Text style={{ color: colors.textMuted, lineHeight: 20 }}>
                  {selectedApp.description}
                </Text>
                {selectedApp.kind === 'game' || selectedApp.id === 'watch' ? (
                  <Pressable
                    style={{ ...primaryBtn, opacity: busyId === selectedApp.id ? 0.6 : 1 }}
                    disabled={busyId === selectedApp.id}
                    onPress={() => void launchApp(selectedApp)}
                  >
                    <Text style={primaryBtnText}>
                      {busyId === selectedApp.id ? 'Açılıyor…' : 'Başlat'}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={primaryBtn}
                    onPress={() => {
                      setAddedApps((prev) => new Set(prev).add(selectedApp.id));
                    }}
                  >
                    <Text style={primaryBtnText}>
                      {addedApps.has(selectedApp.id) ? 'Eklendi (demo)' : 'Ekle'}
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => setSelectedApp(null)}
                  style={{
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceHigh,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontWeight: '700' }}>Kapat</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
