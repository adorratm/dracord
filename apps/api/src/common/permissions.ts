/** Sunucu izin sabitleri — seed ve requirePermission ile uyumlu */
export const GuildPermissions = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  MANAGE_GUILD: 'MANAGE_GUILD',
  MANAGE_CHANNELS: 'MANAGE_CHANNELS',
  MANAGE_MESSAGES: 'MANAGE_MESSAGES',
  MANAGE_ROLES: 'MANAGE_ROLES',
  KICK_MEMBERS: 'KICK_MEMBERS',
  VIEW_CHANNELS: 'VIEW_CHANNELS',
  SEND_MESSAGES: 'SEND_MESSAGES',
  CREATE_POLLS: 'CREATE_POLLS',
  ADD_REACTIONS: 'ADD_REACTIONS',
} as const;

export type GuildPermissionName =
  (typeof GuildPermissions)[keyof typeof GuildPermissions];
