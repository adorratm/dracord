import { useEffect, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import type { PublicUser } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { useAuth } from '../lib/auth';
import { inputStyle, primaryBtn, primaryBtnText } from '../lib/ui';
import { UserAvatar } from './UserAvatar';

type Tab = 'friends' | 'pending' | 'blocked' | 'add';

export function FriendsHub({
  onOpenDm,
}: {
  onOpenDm?: (userId: string) => void;
}) {
  const { client } = useAuth();
  const [friends, setFriends] = useState<PublicUser[]>([]);
  const [incoming, setIncoming] = useState<PublicUser[]>([]);
  const [outgoing, setOutgoing] = useState<PublicUser[]>([]);
  const [blocked, setBlocked] = useState<PublicUser[]>([]);
  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);

  const reload = () => {
    void client.getFriends().then(setFriends);
    void client.getPendingFriends().then((p) => {
      setIncoming(p.incoming ?? []);
      setOutgoing(p.outgoing ?? []);
    });
    void client.listBlocked().then(setBlocked);
  };

  useEffect(() => {
    reload();
  }, [client]);

  const tabs: Array<[Tab, string]> = [
    ['friends', 'Tümü'],
    ['pending', 'İstekler'],
    ['blocked', 'Engellenen'],
    ['add', 'Ekle'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 }}>
        {tabs.map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: tab === k ? colors.surfaceHigh : 'transparent',
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text style={{ color: colors.danger, paddingHorizontal: 16 }}>{error}</Text>
      ) : null}

      {tab === 'add' ? (
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Kullanıcı ara"
              placeholderTextColor={colors.textMuted}
              style={{ ...inputStyle, flex: 1 }}
              onSubmitEditing={() => {
                if (!query.trim()) return;
                setError(null);
                setSearchBusy(true);
                void client
                  .searchUsers(query.trim())
                  .then(setResults)
                  .catch((err) => setError(err instanceof Error ? err.message : 'Arama başarısız'))
                  .finally(() => setSearchBusy(false));
              }}
            />
            <Pressable
              style={primaryBtn}
              onPress={() => {
                if (!query.trim()) return;
                setError(null);
                setSearchBusy(true);
                void client
                  .searchUsers(query.trim())
                  .then(setResults)
                  .catch((err) => setError(err instanceof Error ? err.message : 'Arama başarısız'))
                  .finally(() => setSearchBusy(false));
              }}
            >
              {searchBusy ? (
                <ActivityIndicator color={colors.primaryOn} />
              ) : (
                <Text style={primaryBtnText}>Ara</Text>
              )}
            </Pressable>
          </View>
          <FlatList
            data={results}
            keyExtractor={(u) => u.id}
            renderItem={({ item: u }) => (
              <UserRow
                user={u}
                actions={
                  <Pressable
                    style={{ ...primaryBtn, height: 36, paddingHorizontal: 12 }}
                    onPress={() => {
                      void client
                        .sendFriendRequest(u.id)
                        .then(() => {
                          setTab('pending');
                          reload();
                        })
                        .catch((err) =>
                          setError(err instanceof Error ? err.message : 'İstek gönderilemedi'),
                        );
                    }}
                  >
                    <Text style={{ ...primaryBtnText, fontSize: 13 }}>İstek gönder</Text>
                  </Pressable>
                }
              />
            )}
          />
        </View>
      ) : tab === 'pending' ? (
        <FlatList
          data={[...incoming.map((u) => ({ u, kind: 'in' as const })), ...outgoing.map((u) => ({ u, kind: 'out' as const }))]}
          keyExtractor={(row) => `${row.kind}-${row.u.id}`}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            incoming.length > 0 ? (
              <Text style={{ color: colors.textMuted, fontWeight: '700', marginBottom: 8 }}>Gelen</Text>
            ) : null
          }
          renderItem={({ item: row }) =>
            row.kind === 'in' ? (
              <UserRow
                user={row.u}
                actions={
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={{ ...primaryBtn, height: 36, paddingHorizontal: 12 }}
                      onPress={() => void client.acceptFriendRequest(row.u.id).then(reload)}
                    >
                      <Text style={{ ...primaryBtnText, fontSize: 13 }}>Kabul</Text>
                    </Pressable>
                    <Pressable
                      style={{
                        height: 36,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: colors.danger,
                        justifyContent: 'center',
                      }}
                      onPress={() => void client.declineFriendRequest(row.u.id).then(reload)}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reddet</Text>
                    </Pressable>
                  </View>
                }
              />
            ) : (
              <UserRow
                user={row.u}
                actions={<Text style={{ color: colors.textMuted }}>Bekliyor</Text>}
              />
            )
          }
        />
      ) : (
        <FlatList
          data={tab === 'friends' ? friends : blocked}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textMuted }}>
              {tab === 'friends' ? 'Henüz arkadaş yok.' : 'Engellenen yok.'}
            </Text>
          }
          renderItem={({ item: u }) => (
            <UserRow
              user={u}
              actions={
                tab === 'friends' ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={{ ...primaryBtn, height: 36, paddingHorizontal: 12 }}
                      onPress={() => {
                        void client.openDm(u.id).then(() => onOpenDm?.(u.id));
                      }}
                    >
                      <Text style={{ ...primaryBtnText, fontSize: 13 }}>Mesaj</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void client.blockUser(u.id).then(reload)}
                      style={{ justifyContent: 'center', paddingHorizontal: 8 }}
                    >
                      <Text style={{ color: colors.danger, fontSize: 13 }}>Engelle</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={{ ...primaryBtn, height: 36, paddingHorizontal: 12 }}
                    onPress={() => void client.unblockUser(u.id).then(reload)}
                  >
                    <Text style={{ ...primaryBtnText, fontSize: 13 }}>Engeli kaldır</Text>
                  </Pressable>
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}

function UserRow({ user, actions }: { user: PublicUser; actions: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceHigh,
      }}
    >
      <UserAvatar
        displayName={user.displayName}
        imageUrl={user.avatarUrl}
        size={40}
        status={user.status ?? 'OFFLINE'}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>
          {user.displayName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          @{user.username}
        </Text>
      </View>
      {actions}
    </View>
  );
}
