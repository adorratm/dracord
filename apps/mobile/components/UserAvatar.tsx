import { memo, useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import type { PresenceStatus } from '@dracord/types';
import { colors } from '@dracord/app-theme';
import { statusColor } from '../lib/ui';
import { resolveMediaUrl } from '../lib/mediaUrl';
import { useThemeRevision } from '../lib/theme-revision';

export const UserAvatar = memo(function UserAvatar({
  displayName,
  imageUrl,
  size = 36,
  status,
  speaking,
  statusRing = true,
}: {
  displayName: string;
  imageUrl?: string | null;
  size?: number;
  status?: PresenceStatus | null;
  speaking?: boolean;
  statusRing?: boolean;
}) {
  useThemeRevision();
  const initials = (displayName || '?').slice(0, 2).toUpperCase();
  const r = size / 2;
  const dot = Math.max(10, Math.round(size * 0.32));
  const uri = resolveMediaUrl(imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: colors.surfaceHigh,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: speaking ? 2 : 0,
          borderColor: speaking ? colors.primary : 'transparent',
        }}
      >
        {uri && !failed ? (
          <Image
            source={{ uri }}
            style={{ width: size, height: size }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: size * 0.32 }}>
            {initials}
          </Text>
        )}
      </View>
      {statusRing && status ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: statusColor[status] ?? colors.offline,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </View>
  );
});
