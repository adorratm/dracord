import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  MessageHide,
  ChannelReadState,
  Notification,
  Reaction,
  Role,
  RolePermission,
  Session,
  User,
} from './entities';

const entities = [
  User,
  Account,
  Session,
  Guild,
  GuildMember,
  GuildInvite,
  Category,
  Channel,
  Message,
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
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
