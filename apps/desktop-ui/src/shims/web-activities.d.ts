/** Vite web activity imports — tip kontrolü için gevşek deklarasyonlar */
declare module '../../../web/components/activities/games/BilliardsGame' {
  import type { ComponentType } from 'react';
  export const BilliardsGame: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/games/BlackjackGame' {
  import type { ComponentType } from 'react';
  export const BlackjackGame: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/games/BowlingGame' {
  import type { ComponentType } from 'react';
  export const BowlingGame: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/games/OkeyGame' {
  import type { ComponentType } from 'react';
  export const OkeyGame: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/games/TavlaGame' {
  import type { ComponentType } from 'react';
  export const TavlaGame: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/games/WatchPartyRoom' {
  import type { ComponentType } from 'react';
  export const WatchPartyRoom: ComponentType<Record<string, unknown>>;
}
declare module '../../../web/components/activities/ActivityStageShell' {
  import type { ComponentType, ReactNode } from 'react';
  export const ActivityStageShell: ComponentType<{
    className?: string;
    header?: ReactNode;
    children?: ReactNode;
    chatPanel?: ReactNode;
    participantsPanel?: ReactNode;
    chatOpen?: boolean;
    participantsOpen?: boolean;
    onToggleChat?: () => void;
    onToggleParticipants?: () => void;
    chatPanelWidth?: number;
    onChatPanelWidthChange?: (w: number) => void;
    participantsPanelWidth?: number;
    onParticipantsPanelWidthChange?: (w: number) => void;
  }>;
}
