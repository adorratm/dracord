import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Client } from '@elastic/elasticsearch';
import {
  Account,
  Category,
  Channel,
  DMChannel,
  DMChannelMember,
  Friendship,
  Guild,
  GuildInvite,
  GuildMember,
  GuildMemberRole,
  Message,
  Reaction,
  Role,
  RolePermission,
  Session,
  User,
} from '@/database/entities';

loadEnv({ path: resolve(__dirname, '../../../.env') });
loadEnv({ path: resolve(__dirname, '../../.env') });

async function main() {
  const url = process.env.ELASTICSEARCH_URL;
  if (!url) throw new Error('ELASTICSEARCH_URL gerekli');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL gerekli');

  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: [
      User,
      Account,
      Session,
      Guild,
      GuildMember,
      GuildInvite,
      Category,
      Channel,
      Message,
      Reaction,
      Role,
      RolePermission,
      GuildMemberRole,
      Friendship,
      DMChannel,
      DMChannelMember,
    ],
    synchronize: false,
  });
  await ds.initialize();
  const em = ds.manager;
  const client = new Client({ node: url });
  await client.ping();

  const indices = [
    'dracord-messages',
    'dracord-guilds',
    'dracord-channels',
    'dracord-users',
  ];
  for (const index of indices) {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      console.log(`index missing: ${index} — start API once to create mappings`);
    }
  }

  const users = await em.find(User);
  for (const u of users) {
    await client.index({
      index: 'dracord-users',
      id: u.id,
      document: {
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
      },
    });
  }

  const guilds = await em.find(Guild);
  for (const g of guilds) {
    const members = await em.find(GuildMember, {
      where: { guildId: g.id },
      select: { userId: true },
    });
    await client.index({
      index: 'dracord-guilds',
      id: g.id,
      document: {
        name: g.name,
        iconUrl: g.iconUrl,
        discoverable: Boolean(g.discoverable),
        memberIds: members.map((m) => m.userId),
      },
    });
  }

  const channels = await em.find(Channel);
  for (const c of channels) {
    await client.index({
      index: 'dracord-channels',
      id: c.id,
      document: {
        guildId: c.guildId,
        dmChannelId: c.dmChannelId,
        name: c.name,
        channelType: c.type,
      },
    });
  }

  const messages = await em.find(Message, {
    relations: { author: true },
    take: 50_000,
  });
  const live = messages.filter((m) => !m.deletedAt);
  for (const m of live) {
    const ch = channels.find((c) => c.id === m.channelId);
    await client.index({
      index: 'dracord-messages',
      id: m.id,
      document: {
        channelId: m.channelId,
        guildId: ch?.guildId ?? null,
        dmChannelId: ch?.dmChannelId ?? null,
        authorId: m.authorId,
        authorName: m.author.displayName,
        content: m.content,
        attachmentNames: (m.attachments ?? []).map((a) => a.filename).join(' '),
        createdAt: m.createdAt.toISOString(),
      },
    });
  }

  await client.indices.refresh({ index: indices });
  console.log(
    JSON.stringify({
      users: users.length,
      guilds: guilds.length,
      channels: channels.length,
      messages: live.length,
    }),
  );
  await ds.destroy();
  await client.close();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
