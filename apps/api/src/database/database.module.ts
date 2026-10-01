import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Account,
  AuditLog,
  Category,
  Channel,
  DMChannel,
  DMChannelMember,
  Friendship,
  Guild,
  GuildBan,
  GuildInvite,
  GuildMember,
  GuildMemberRole,
  Message,
  MessageBookmark,
  MessageHide,
  ChannelReadState,
  Notification,
  PushSubscription,
  Reaction,
  Role,
  RolePermission,
  Session,
  SlashCommand,
  User,
} from './entities';
import { DatabaseBootstrapService } from './database-bootstrap.service';

const entities = [
  User,
  Account,
  Session,
  Guild,
  GuildMember,
  GuildBan,
  AuditLog,
  GuildInvite,
  Category,
  Channel,
  Message,
  MessageBookmark,
  MessageHide,
  ChannelReadState,
  Reaction,
  Role,
  RolePermission,
  GuildMemberRole,
  Friendship,
  DMChannel,
  DMChannelMember,
  Notification,
  PushSubscription,
  SlashCommand,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities,
        // Prod default: false. First boot: set DATABASE_SYNCHRONIZE=true once, then remove.
        synchronize:
          config.get<string>('DATABASE_SYNCHRONIZE') === 'true' ||
          config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
  providers: [DatabaseBootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
