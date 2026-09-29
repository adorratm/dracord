import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';
import {
  Account,
  Category,
  Channel,
  DMChannel,
  DMChannelMember,
  Friendship,
  Guild,
  GuildMember,
  GuildMemberRole,
  Message,
  Reaction,
  Role,
  RolePermission,
  Session,
  User,
} from './entities';
import { AuthProvider, ChannelType, FriendshipStatus, UserStatus } from './enums';

async function upsertUser(
  em: EntityManager,
  data: {
    email: string;
    username: string;
    displayName: string;
    passwordHash: string;
    status: UserStatus;
    bannerColor?: string | null;
    id?: string;
  },
): Promise<User> {
  let user = await em.findOne(User, { where: { email: data.email } });
  if (user) {
    user.status = data.status;
    await em.save(User, user);
    return user;
  }

  user = await em.save(
    User,
    em.create(User, {
      id: data.id,
      email: data.email,
      username: data.username,
      displayName: data.displayName,
      passwordHash: data.passwordHash,
      bannerColor: data.bannerColor ?? null,
      status: data.status,
    }),
  );

  const existingAccount = await em.findOne(Account, {
    where: {
      provider: AuthProvider.DEV,
      providerAccountId: `${data.username}-dev`,
    },
  });
  if (!existingAccount) {
    await em.save(
      Account,
      em.create(Account, {
        userId: user.id,
        provider: AuthProvider.DEV,
        providerAccountId: `${data.username}-dev`,
      }),
    );
  }

  return user;
}

async function main() {
  try {
    const { config } = await import('dotenv');
    const path = await import('path');
    config({ path: path.join(__dirname, '../../.env') });
  } catch {
    // dotenv optional
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      User,
      Account,
      Session,
      Guild,
      GuildMember,
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
    synchronize: true,
  });
  await ds.initialize();
  const em = ds.manager;

  const passwordHash = await bcrypt.hash('dracord123', 10);

  const owner = await upsertUser(em, {
    email: 'vlad@dracord.com.tr',
    username: 'vlad',
    displayName: 'Vlad Dracula',
    passwordHash,
    bannerColor: '#7C0A02',
    status: UserStatus.ONLINE,
  });

  const memberDefs = [
    {
      email: 'mina@dracord.com.tr',
      username: 'mina',
      displayName: 'Mina Harker',
      status: UserStatus.IDLE,
    },
    {
      email: 'renfield@dracord.com.tr',
      username: 'renfield',
      displayName: 'Renfield',
      status: UserStatus.DND,
    },
    {
      email: 'lucy@dracord.com.tr',
      username: 'lucy',
      displayName: 'Lucy Westenra',
      status: UserStatus.ONLINE,
    },
  ];

  const members = await Promise.all(
    memberDefs.map((u) => upsertUser(em, { ...u, passwordHash, status: u.status })),
  );

  let guild = await em.findOne(Guild, { where: { id: 'seed-dracula-realm' } });
  if (!guild) {
    guild = await em.save(
      Guild,
      em.create(Guild, {
        id: 'seed-dracula-realm',
        name: 'Dracula Realm',
        iconUrl: null,
        ownerId: owner.id,
        discoverable: true,
      }),
    );
  } else {
    guild.name = 'Dracula Realm';
    guild.discoverable = true;
    guild = await em.save(Guild, guild);
  }

  for (const u of [owner, ...members]) {
    const existing = await em.findOne(GuildMember, {
      where: { guildId: guild.id, userId: u.id },
    });
    if (!existing) {
      await em.save(
        GuildMember,
        em.create(GuildMember, { guildId: guild.id, userId: u.id }),
      );
    }
  }

  async function upsertRole(
    id: string,
    data: { guildId: string; name: string; color: string; position: number },
    permissions: string[],
  ) {
    let role = await em.findOne(Role, { where: { id } });
    if (!role) {
      role = await em.save(Role, em.create(Role, { id, ...data }));
    }
    for (const permission of permissions) {
      const perm = await em.findOne(RolePermission, {
        where: { roleId: id, permission },
      });
      if (!perm) {
        await em.save(
          RolePermission,
          em.create(RolePermission, { roleId: id, permission }),
        );
      }
    }
  }

  await upsertRole(
    'seed-everyone-role',
    {
      guildId: guild.id,
      name: '@everyone',
      color: '#99AAB5',
      position: 0,
    },
    ['VIEW_CHANNELS', 'SEND_MESSAGES', 'ADD_REACTIONS', 'CREATE_POLLS'],
  );

  await upsertRole(
    'seed-mod-role',
    {
      guildId: guild.id,
      name: 'Nosferatu Mod',
      color: '#7C0A02',
      position: 1,
    },
    [
      'MANAGE_MESSAGES',
      'KICK_MEMBERS',
      'MANAGE_CHANNELS',
      'MANAGE_GUILD',
      'CREATE_POLLS',
      'ADD_REACTIONS',
      'ADMINISTRATOR',
    ],
  );

  async function upsertCategory(id: string, name: string, position: number) {
    let cat = await em.findOne(Category, { where: { id } });
    if (!cat) {
      cat = await em.save(
        Category,
        em.create(Category, { id, guildId: guild!.id, name, position }),
      );
    } else {
      cat.name = name;
      cat.position = position;
      cat = await em.save(Category, cat);
    }
    return cat;
  }

  const infoCategory = await upsertCategory('seed-cat-info', 'Bilgi', 0);
  const chatCategory = await upsertCategory('seed-cat-chat', 'Sohbet', 1);
  const voiceCategory = await upsertCategory('seed-cat-voice', 'Ses', 2);

  const channelDefs: Array<{
    id: string;
    name: string;
    type: ChannelType;
    categoryId: string;
    position: number;
  }> = [
    {
      id: 'seed-ch-genel',
      name: 'genel',
      type: ChannelType.TEXT,
      categoryId: chatCategory.id,
      position: 0,
    },
    {
      id: 'seed-ch-kurallar',
      name: 'kurallar',
      type: ChannelType.TEXT,
      categoryId: infoCategory.id,
      position: 0,
    },
    {
      id: 'seed-ch-duyurular',
      name: 'duyurular',
      type: ChannelType.TEXT,
      categoryId: infoCategory.id,
      position: 1,
    },
    {
      id: 'seed-ch-yazilim',
      name: 'yazilim-sohbet',
      type: ChannelType.TEXT,
      categoryId: chatCategory.id,
      position: 1,
    },
    {
      id: 'seed-ch-lounge',
      name: 'Lounge',
      type: ChannelType.VOICE,
      categoryId: voiceCategory.id,
      position: 0,
    },
  ];

  for (const ch of channelDefs) {
    let channel = await em.findOne(Channel, { where: { id: ch.id } });
    if (!channel) {
      channel = await em.save(
        Channel,
        em.create(Channel, {
          id: ch.id,
          guildId: guild.id,
          name: ch.name,
          type: ch.type,
          categoryId: ch.categoryId,
          position: ch.position,
        }),
      );
    } else {
      channel.name = ch.name;
      await em.save(Channel, channel);
    }
  }

  const genel = channelDefs[0]!;
  const kurallar = channelDefs[1]!;

  await em.delete(Message, { channelId: genel.id });
  await em.delete(Message, { channelId: kurallar.id });

  await em.save(Message, [
    em.create(Message, {
      channelId: kurallar.id,
      authorId: owner.id,
      content:
        'Hos geldiniz, Dracula Realm sunucusuna. Saygili olun ve kurallara uyun.',
    }),
    em.create(Message, {
      channelId: genel.id,
      authorId: owner.id,
      content: 'Merhaba! NestJS API ve Socket.io ile Dracord ayakta.',
    }),
    em.create(Message, {
      channelId: genel.id,
      authorId: members[0]!.id,
      content: 'Yazilim-sohbet kanalinda TypeScript konusalim mi?',
    }),
    em.create(Message, {
      channelId: genel.id,
      authorId: members[2]!.id,
      content: 'Lounge ses kanalina geciyorum, katilin!',
    }),
  ]);

  for (const friend of members) {
    let row = await em.findOne(Friendship, {
      where: { userId: owner.id, friendId: friend.id },
    });
    if (!row) {
      row = em.create(Friendship, {
        userId: owner.id,
        friendId: friend.id,
        status: FriendshipStatus.ACCEPTED,
      });
    } else {
      row.status = FriendshipStatus.ACCEPTED;
    }
    await em.save(Friendship, row);
  }

  console.log('Seed completed: Dracula Realm guild with channels and sample messages.');

  // Dracord-Bot — tüm sunuculara
  const {
    DRACORD_BOT_USER_ID,
    DRACORD_BOT_EMAIL,
    DRACORD_BOT_USERNAME,
    DRACORD_BOT_DISPLAY_NAME,
    DRACORD_BOT_AVATAR_PATH,
  } = await import('../bot/bot.constants');
  const frontend = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const botAvatarUrl = `${frontend}${DRACORD_BOT_AVATAR_PATH}`;
  let bot = await em.findOne(User, { where: { id: DRACORD_BOT_USER_ID } });
  if (!bot) {
    bot = await em.save(
      User,
      em.create(User, {
        id: DRACORD_BOT_USER_ID,
        email: DRACORD_BOT_EMAIL,
        username: DRACORD_BOT_USERNAME,
        displayName: DRACORD_BOT_DISPLAY_NAME,
        passwordHash: null,
        avatarUrl: botAvatarUrl,
        bannerColor: '#bd93f9',
        status: UserStatus.ONLINE,
        usernameConfirmed: true,
        isBot: true,
      }),
    );
  } else {
    bot.isBot = true;
    bot.displayName = DRACORD_BOT_DISPLAY_NAME;
    bot.avatarUrl = botAvatarUrl;
    await em.save(User, bot);
  }
  const botMem = await em.findOne(GuildMember, {
    where: { guildId: guild.id, userId: bot.id },
  });
  if (!botMem) {
    await em.save(
      GuildMember,
      em.create(GuildMember, { guildId: guild.id, userId: bot.id }),
    );
  }
  console.log('Dracord-Bot seeded into guild.');

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
