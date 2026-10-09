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
  ActivitySession,
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
  ActivitySession,
];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const poolMax = Number(config.get<string>('DB_POOL_MAX') ?? (isProd ? 20 : 10));
        return {
          type: 'postgres' as const,
          url: config.getOrThrow<string>('DATABASE_URL'),
          entities,
          // Prod default: false. First boot: set DATABASE_SYNCHRONIZE=true once, then remove.
          synchronize:
            config.get<string>('DATABASE_SYNCHRONIZE') === 'true' || !isProd,
          logging:
            config.get<string>('TYPEORM_LOGGING') === 'true'
              ? true
              : isProd
                ? ['error']
                : false,
          maxQueryExecutionTime: Number(
            config.get<string>('DB_SLOW_MS') ?? (isProd ? 500 : 1000),
          ),
          extra: {
            max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
          },
        };
      },
    }),
  ],
  providers: [DatabaseBootstrapService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
