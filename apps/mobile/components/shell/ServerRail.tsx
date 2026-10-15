import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { GuildSummary } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { Icon } from '../Icon';

const RAIL_W = 56;
const BTN = 40;

/** Web ServerRail — mobilde dar sütun */
export function ServerRail({
  guilds,
  activeGuildId,
  homeActive,
  onHome,
  onSelectGuild,
  onCreate,
  onJoin,
  onDiscover,
}: {
  guilds: GuildSummary[];
  activeGuildId: string | null;
  homeActive?: boolean;
  onHome: () => void;
  onSelectGuild: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onDiscover: () => void;
}) {
  return (
    <ScrollView
      style={{ width: RAIL_W, flexGrow: 0, backgroundColor: colors.rail }}
      contentContainerStyle={{ paddingVertical: 10, alignItems: 'center', gap: 8 }}
      showsVerticalScrollIndicator={false}
    >
      <RailBtn active={Boolean(homeActive)} onPress={onHome} icon="chat_bubble" />
      <View
        style={{
          width: 22,
          height: 2,
          borderRadius: 1,
          backgroundColor: colors.surfaceHigh,
          marginVertical: 2,
        }}
      />
      {guilds.map((g) => (
        <RailBtn
          key={g.id}
          active={activeGuildId === g.id && !homeActive}
          label={g.name.slice(0, 2).toUpperCase()}
          imageUrl={g.iconUrl}
          onPress={() => onSelectGuild(g.id)}
        />
      ))}
      <RailBtn onPress={onCreate} outline accent icon="add" />
      <RailBtn onPress={onJoin} outline icon="login" />
      <RailBtn onPress={onDiscover} outline icon="explore" />
    </ScrollView>
  );
}

function RailBtn({
  label,
  active,
  onPress,
  outline,
  accent,
  imageUrl,
  icon,
}: {
  label?: string;
  active?: boolean;
  onPress: () => void;
  outline?: boolean;
  accent?: boolean;
  imageUrl?: string | null;
  icon?: string;
}) {
  const iconColor = active || accent ? colors.primaryOn : colors.text;
  const uri = resolveMediaUrl(imageUrl);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: BTN,
        height: BTN,
        borderRadius: active ? 12 : 20,
        backgroundColor: active || accent
          ? colors.primary
          : outline
            ? 'transparent'
            : colors.surfaceHigh,
        borderWidth: outline && !active && !accent ? 1.5 : 0,
        borderColor: colors.outline,
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
      {active ? (
        <View
          style={{
            position: 'absolute',
            left: -8,
            width: 3,
            height: 22,
            borderRadius: 2,
            backgroundColor: colors.text,
          }}
        />
      ) : null}
    </Pressable>
  );
}
