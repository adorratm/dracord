import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

const googleEnabled = (): boolean => {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
};

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    ...(googleEnabled() ? [GoogleStrategy] : []),
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {
  constructor(private readonly config: ConfigService) {
    void this.config;
  }
}
