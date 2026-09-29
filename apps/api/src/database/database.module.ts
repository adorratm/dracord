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
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
