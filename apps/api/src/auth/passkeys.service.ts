import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { EntityManager } from 'typeorm';
import { User } from '@/database/entities/user.entity';
import { UserPasskey } from '@/database/entities/user-passkey.entity';

const MAX_PASSKEYS = 10;
const STATE_TTL = '5m';

type StateClaims = { c: string; t: 'reg' | 'auth'; u?: string };

const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const fromB64u = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

/**
 * E1 — Passkey (WebAuthn). Kayıt ve giriş durumsuzdur: challenge kısa ömürlü imzalı
 * "state" belirtecinde taşınır; kullanılan challenge'lar tekrar kabul edilmez.
 * Kullanıcı doğrulaması (UV) zorunlu → passkey tek başına iki adımlı sayılır.
 */
@Injectable()
export class PasskeysService {
  private readonly used = new Map<string, number>();

  constructor(
    private readonly em: EntityManager,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private rpId(): string {
    return this.config.get<string>('WEBAUTHN_RP_ID') || 'dracord.com.tr';
  }

  private origins(): string[] {
    const env = (this.config.get<string>('WEBAUTHN_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (env.length) return env;
    const rp = this.rpId();
    const out = [`https://${rp}`, `https://www.${rp}`];
    if (this.config.get<string>('NODE_ENV') !== 'production') out.push('http://localhost:3000');
    return out;
  }

  private secret() {
    return `${this.config.getOrThrow<string>('JWT_ACCESS_SECRET')}:webauthn`;
  }

  private async sign(claims: StateClaims) {
    return this.jwt.signAsync(claims, { secret: this.secret(), expiresIn: STATE_TTL, audience: 'webauthn' });
  }

  private async readState(token: string, t: StateClaims['t']): Promise<StateClaims> {
    let p: StateClaims;
    try {
      p = await this.jwt.verifyAsync<StateClaims>(String(token ?? ''), { secret: this.secret(), audience: 'webauthn' });
    } catch {
      throw new BadRequestException('Passkey isteğinin süresi doldu, tekrar dene');
    }
    if (p.t !== t || !p.c) throw new BadRequestException('Geçersiz passkey isteği');
    // Tek kullanımlık challenge (bu örnekte); süresi zaten 5 dk
    const now = Date.now();
    for (const [k, exp] of this.used) if (exp < now) this.used.delete(k);
    if (this.used.has(p.c)) throw new BadRequestException('Bu passkey isteği zaten kullanıldı');
    this.used.set(p.c, now + 6 * 60_000);
    return p;
  }

  // ── Kayıt (giriş yapmış kullanıcı) ──
  async registrationOptions(userId: string) {
    const user = await this.em.findOneOrFail(User, { where: { id: userId } });
    const existing = await this.em.find(UserPasskey, { where: { userId }, select: { id: true, transports: true } });
    if (existing.length >= MAX_PASSKEYS) throw new BadRequestException(`En fazla ${MAX_PASSKEYS} passkey ekleyebilirsin`);
    const options = await generateRegistrationOptions({
      rpName: 'Dracord',
      rpID: this.rpId(),
      userName: user.username,
      userDisplayName: user.displayName || user.username,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports ?? undefined })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 120_000,
    });
    return { options, state: await this.sign({ c: options.challenge, t: 'reg', u: userId }) };
  }

  async registrationVerify(userId: string, state: string, response: RegistrationResponseJSON, rawName?: string) {
    const st = await this.readState(state, 'reg');
    if (st.u !== userId) throw new ForbiddenException('Passkey isteği başka hesaba ait');
    let v;
    try {
      v = await verifyRegistrationResponse({
        response,
        expectedChallenge: st.c,
        expectedOrigin: this.origins(),
        expectedRPID: this.rpId(),
        requireUserVerification: true,
      });
    } catch (e) {
      throw new BadRequestException(`Passkey doğrulanamadı: ${e instanceof Error ? e.message : 'hata'}`);
    }
    if (!v.verified || !v.registrationInfo) throw new BadRequestException('Passkey doğrulanamadı');
    const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
    if (await this.em.findOne(UserPasskey, { where: { id: credential.id } })) throw new BadRequestException('Bu passkey zaten kayıtlı');
    const count = await this.em.count(UserPasskey, { where: { userId } });
    if (count >= MAX_PASSKEYS) throw new BadRequestException(`En fazla ${MAX_PASSKEYS} passkey ekleyebilirsin`);
    const name = String(rawName ?? '').replace(/\s+/g, ' ').trim().slice(0, 64) || `Passkey ${count + 1}`;
    await this.em.insert(UserPasskey, {
      id: credential.id,
      userId,
      publicKey: b64u(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? null,
      name,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      lastUsedAt: null,
    });
    return this.list(userId);
  }

  async list(userId: string) {
    const rows = await this.em.find(UserPasskey, { where: { userId }, order: { createdAt: 'ASC' } });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      synced: r.backedUp || r.deviceType === 'multiDevice',
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async rename(userId: string, id: string, name: string) {
    const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 64);
    if (!n) throw new BadRequestException('Ad gerekli');
    const res = await this.em.update(UserPasskey, { id, userId }, { name: n });
    if (!res.affected) throw new NotFoundException('Passkey bulunamadı');
    return this.list(userId);
  }

  async remove(userId: string, id: string) {
    const res = await this.em.delete(UserPasskey, { id, userId });
    if (!res.affected) throw new NotFoundException('Passkey bulunamadı');
    return this.list(userId);
  }

  // ── Giriş (herkese açık) ──
  async loginOptions() {
    const options = await generateAuthenticationOptions({ rpID: this.rpId(), userVerification: 'required', timeout: 120_000 });
    return { options, state: await this.sign({ c: options.challenge, t: 'auth' }) };
  }

  /** Doğrulanırsa kullanıcıyı döndürür (belirteçleri çağıran üretir) */
  async loginVerify(state: string, response: AuthenticationResponseJSON): Promise<User> {
    const st = await this.readState(state, 'auth');
    const id = String(response?.id ?? '');
    const pk = id ? await this.em.findOne(UserPasskey, { where: { id } }) : null;
    if (!pk) throw new UnauthorizedException('Bu passkey tanınmıyor. Hesabından silinmiş olabilir.');
    // Kimlik doğrulayıcı kullanıcı tanıtıcısı gönderdiyse eşleşmeli
    const handle = response.response?.userHandle;
    if (handle && Buffer.from(handle, 'base64url').toString('utf8') !== pk.userId) {
      throw new UnauthorizedException('Passkey doğrulanamadı');
    }
    let v;
    try {
      v = await verifyAuthenticationResponse({
        response,
        expectedChallenge: st.c,
        expectedOrigin: this.origins(),
        expectedRPID: this.rpId(),
        credential: { id: pk.id, publicKey: fromB64u(pk.publicKey), counter: pk.counter, transports: pk.transports ?? undefined },
        requireUserVerification: true,
      });
    } catch {
      throw new UnauthorizedException('Passkey doğrulanamadı');
    }
    if (!v.verified) throw new UnauthorizedException('Passkey doğrulanamadı');
    const { newCounter } = v.authenticationInfo;
    // Sayaç geri gittiyse kopyalanmış kimlik doğrulayıcı şüphesi (0 = sayaç kullanmayan passkey)
    if (pk.counter > 0 && newCounter <= pk.counter) throw new UnauthorizedException('Passkey reddedildi (sayaç uyuşmazlığı)');
    await this.em.update(UserPasskey, { id: pk.id }, { counter: newCounter, lastUsedAt: new Date() });
    const user = await this.em.findOne(User, { where: { id: pk.userId } });
    if (!user) throw new UnauthorizedException('Hesap bulunamadı');
    return user;
  }
}
