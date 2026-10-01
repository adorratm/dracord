/** Sunucu izin sabitleri — seed ve requirePermission ile uyumlu */
export const GuildPermissions = {
  ADMINISTRATOR: 'ADMINISTRATOR',
  MANAGE_GUILD: 'MANAGE_GUILD',
  MANAGE_CHANNELS: 'MANAGE_CHANNELS',
  MANAGE_MESSAGES: 'MANAGE_MESSAGES',
  MANAGE_ROLES: 'MANAGE_ROLES',
  KICK_MEMBERS: 'KICK_MEMBERS',
  BAN_MEMBERS: 'BAN_MEMBERS',
  MOVE_MEMBERS: 'MOVE_MEMBERS',
  MODERATE_MEMBERS: 'MODERATE_MEMBERS',
  VIEW_CHANNELS: 'VIEW_CHANNELS',
  SEND_MESSAGES: 'SEND_MESSAGES',
  CREATE_POLLS: 'CREATE_POLLS',
  ADD_REACTIONS: 'ADD_REACTIONS',
} as const;

export type GuildPermissionName =
  (typeof GuildPermissions)[keyof typeof GuildPermissions];

/** Rol izin editöründe gösterilecek etiketler */
export const GUILD_PERMISSION_LABELS: Record<GuildPermissionName, string> = {
  ADMINISTRATOR: 'Yönetici',
  MANAGE_GUILD: 'Sunucuyu yönet',
  MANAGE_CHANNELS: 'Kanalları yönet',
  MANAGE_MESSAGES: 'Mesajları yönet',
  MANAGE_ROLES: 'Rolleri yönet',
  KICK_MEMBERS: 'Üye at',
  BAN_MEMBERS: 'Üye yasakla',
  MOVE_MEMBERS: 'Ses taşı / ayır',
  MODERATE_MEMBERS: 'Timeout',
  VIEW_CHANNELS: 'Kanalları gör',
  SEND_MESSAGES: 'Mesaj gönder',
  CREATE_POLLS: 'Anket oluştur',
  ADD_REACTIONS: 'Tepki ekle',
};
