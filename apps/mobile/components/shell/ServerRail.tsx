import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { GuildSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { Icon } from '../Icon';

const RAIL_W = 56;
const BTN = 40;

export type RailGuild = GuildSummary & { favorite?: boolean };

/** Web ServerRail — mobilde dar sütun; favoriler üstte + ayırıcı */
export function ServerRail({
  guilds,
  activeGuildId,
  homeActive,
  onHome,
  onSelectGuild,
  onCreate,
  onJoin,
  onDiscover,
  onToggleFavorite,
}: {
  guilds: RailGuild[];
  activeGuildId: string | null;
  homeActive?: boolean;
  onHome: () => void;
  onSelectGuild: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDiscover: () => void;
  onToggleFavorite?: (guildId: string) => void;
}) {
  const { favorites, others } = useMemo(() => {
    const favs = guilds.filter((g) => g.favorite);
    const rest = guilds.filter((g) => !g.favorite);
    return { favorites: favs, others: rest };
  }, [guilds]);

  return (
    <ScrollView
      style={{ width: RAIL_W, flexGrow: 0, backgroundColor: colors.rail }}
      contentContainerStyle={{ paddingVertical: 10, alignItems: 'center', gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <RailBtn active={Boolean(homeActive)} onPress={onHome} icon="chat_bubble" />
      <RailDivider />
      {favorites.map((g) => (
        <RailBtn
          key={g.id}
          active={activeGuildId === g.id && !homeActive}
          label={g.name.slice(0, 2).toUpperCase()}
          imageUrl={g.iconUrl}
          favorite
          onPress={() => onSelectGuild(g.id)}
          onLongPress={
            onToggleFavorite ? () => onToggleFavorite(g.id) : undefined
          }
        />
      ))}
      {favorites.length > 0 && others.length > 0 ? <RailDivider /> : null}
      {others.map((g) => (
        <RailBtn
          key={g.id}
          active={activeGuildId === g.id && !homeActive}
          label={g.name.slice(0, 2).toUpperCase()}
          imageUrl={g.iconUrl}
          onPress={() => onSelectGuild(g.id)}
          onLongPress={
            onToggleFavorite ? () => onToggleFavorite(g.id) : undefined
          }
        />
      ))}
      <RailBtn onPress={onCreate} outline accent icon="add" />
      <RailBtn onPress={onJoin} outline icon="login" />
      <RailBtn onPress={onDiscover} outline icon="explore" />
    </ScrollView>
  );
}

function RailDivider() {
  return (
    <View
      style={{
        width: 22,
        height: 2,
        borderRadius: 1,
        backgroundColor: colors.surfaceHigh,
        marginVertical: 2,
      }}
    />
  );
}

function RailBtn({
  label,
  active,
  onPress,
  onLongPress,
  outline,
  accent,
  favorite,
  imageUrl,
  icon,
}: {
  label?: string;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  outline?: boolean;
  accent?: boolean;
  favorite?: boolean;
  imageUrl?: string | null;
  icon?: string;
}) {
  const iconColor = active || accent ? colors.primaryOn : colors.text;
  const uri = resolveMediaUrl(imageUrl);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <View style={{ width: RAIL_W, height: BTN, alignItems: 'center', justifyContent: 'center' }}>
      {/* Web ActivePill — buton overflow:hidden dışında, rayın sol kenarında */}
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: (BTN - 36) / 2,
            width: 4,
            height: 36,
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            backgroundColor: colors.primary,
            zIndex: 2,
          }}
        />
      ) : null}
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => ({
          width: BTN,
          height: BTN,
          borderRadius: active ? 12 : 20,
          backgroundColor: active || accent
            ? colors.primary
            : outline
              ? 'transparent'
              : colors.surfaceHigh,
          borderWidth:
            outline && !active && !accent
              ? 1.5
              : favorite && !active
                ? 1.5
                : 0,
          borderColor: favorite && !active && !outline ? colors.primary : colors.outline,
          borderStyle: outline && !accent ? 'dashed' : 'solid',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          overflow: 'hidden',
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        {uri && !outline && !imgFailed ? (
          <Image
            source={{ uri }}
            style={{ width: BTN, height: BTN, borderRadius: active ? 12 : 20 }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : icon ? (
          <Icon name={icon} size={20} color={iconColor} />
        ) : (
          <Text
            style={{
              color: iconColor,
              fontWeight: '800',
              fontSize: 11,
            }}
          >
            {label}
          </Text>
        )}
        {favorite && !outline ? (
          <View
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: colors.rail,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="star" size={11} color={colors.primary} />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
