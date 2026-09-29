import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleProfile {
  provider: 'google';
  providerAccountId: string;
  email: string;
  displayName: string;
  username: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:4000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google profile missing email'), undefined);
      return;
    }
    const username =
      profile.displayName.replace(/\s+/g, '').toLowerCase().slice(0, 32) ||
      email.split('@')[0]!;
    const result: GoogleProfile = {
      provider: 'google',
      providerAccountId: profile.id,
      email,
      displayName: profile.displayName || username,
      username,
    };
    done(null, result);
  }
}
