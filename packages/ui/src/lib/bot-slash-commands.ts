/** Bot müzik slash komutları (ChatInput autocomplete + mesaj vurgusu). */

export interface BotSlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  argRequired?: boolean;
}

export const BOT_SLASH_COMMANDS: BotSlashCommand[] = [
  {
    name: 'oynat',
    aliases: ['play'],
    description: 'Şarkı veya URL çal',
    usage: '/oynat <şarkı veya url>',
    argRequired: true,
  },
  {
    name: 'atla',
    aliases: ['skip'],
    description: 'Sonraki şarkıya geç',
    usage: '/atla',
  },
  {
    name: 'duraklat',
    aliases: ['pause'],
    description: 'Çalmayı duraklat',
    usage: '/duraklat',
  },
  {
    name: 'devam',
    aliases: ['resume'],
    description: 'Çalmaya devam et',
    usage: '/devam',
  },
  {
    name: 'durdur',
    aliases: ['stop'],
    description: 'Müziği durdur ve kuyruğu temizle',
    usage: '/durdur',
  },
  {
    name: 'kuyruk',
    aliases: ['queue'],
    description: 'Kuyruğu göster',
    usage: '/kuyruk',
  },
  {
    name: 'ses',
    aliases: ['volume'],
    description: 'Bot sunucu ses seviyesini ayarla (0–100)',
    usage: '/ses <0-100>',
    argRequired: true,
  },
  {
    name: 'kaldir',
    aliases: ['remove'],
    description: 'Kuyruktan parça kaldır',
    usage: '/kaldir <sıra>',
    argRequired: true,
  },
];

const ALL_NAMES = new Set(
  BOT_SLASH_COMMANDS.flatMap((c) => [c.name, ...(c.aliases ?? [])]).map((n) =>
    n.toLocaleLowerCase('tr-TR'),
  ),
);

export function isKnownBotSlashCommand(cmd: string): boolean {
  return ALL_NAMES.has(cmd.toLocaleLowerCase('tr-TR'));
}

export function filterBotSlashCommands(query: string): BotSlashCommand[] {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return BOT_SLASH_COMMANDS;
  return BOT_SLASH_COMMANDS.filter((c) => {
    if (c.name.includes(q)) return true;
    if (c.aliases?.some((a) => a.includes(q))) return true;
    if (c.description.toLocaleLowerCase('tr-TR').includes(q)) return true;
    return false;
  });
}
