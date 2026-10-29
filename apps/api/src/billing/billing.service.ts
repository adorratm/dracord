import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';
import { User } from '@/database/entities/user.entity';
import { mergeClientSettings } from '@/users/client-settings';
import { isNitroPaymentsEnabled } from '@/platform/platform-enabled';
import { createId } from '@paralleldrive/cuid2';
import { paytrPaymentHash, paytrVerifyCallback } from './paytr';

const PLAN_AMOUNT_KURUS: Record<'basic' | 'nitro', string> = {
  basic: '4990',
  nitro: '9990',
};

@Injectable()
export class BillingService {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  async getMe(userId: string) {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı yok');
    const settings = mergeClientSettings(user.clientSettings);
    return {
      billing: settings.billing,
      paymentsEnabled: isNitroPaymentsEnabled(this.config),
      paytrMerchantId: this.config.get<string>('PAYTR_MERCHANT_ID') || null,
    };
  }

  /** Checkout: PayTR iFrame token veya demo */
  async checkout(
    userId: string,
    plan: 'basic' | 'nitro',
    opts?: { userIp?: string },
  ) {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı yok');

    if (!isNitroPaymentsEnabled(this.config)) {
      return {
        mode: 'demo' as const,
        plan,
        message: 'NITRO_PAYMENTS kapalı — subscribe demo kullanılabilir',
      };
    }

    const merchantId = this.config.get<string>('PAYTR_MERCHANT_ID')?.trim();
    const merchantKey = this.config.get<string>('PAYTR_MERCHANT_KEY')?.trim();
    const merchantSalt = this.config.get<string>('PAYTR_MERCHANT_SALT')?.trim();
    if (!merchantId || !merchantKey || !merchantSalt) {
      throw new ServiceUnavailableException(
        'PayTR anahtarları eksik (PAYTR_MERCHANT_ID/KEY/SALT)',
      );
    }

    const merchantOid = `${userId}:${plan}:${Date.now()}`;
    const paymentAmount = PLAN_AMOUNT_KURUS[plan];
    const email = user.email || `${userId}@dracord.local`;
    const userIp = opts?.userIp || '127.0.0.1';
    const userBasket = Buffer.from(
      JSON.stringify([[plan === 'nitro' ? 'Nitro' : 'Nitro Basic', paymentAmount, 1]]),
    ).toString('base64');
    const noInstallment = '0';
    const maxInstallment = '0';
    const currency = 'TL';
    const testMode = this.config.get<string>('PAYTR_TEST_MODE') === 'true' ? '1' : '0';
    const paytrToken = paytrPaymentHash({
      merchantId,
      userIp,
      merchantOid,
      email,
      paymentAmount,
      userBasket,
      noInstallment,
      maxInstallment,
      currency,
      testMode,
      merchantSalt,
      merchantKey,
    });

    // get-token çağrısı — ağ hatasında client’a hash + alanları ver (iframe manuel)
    let iframeToken: string | null = null;
    try {
      const body = new URLSearchParams({
        merchant_id: merchantId,
        user_ip: userIp,
        merchant_oid: merchantOid,
        email,
        payment_amount: paymentAmount,
        paytr_token: paytrToken,
        user_basket: userBasket,
        debug_on: testMode,
        no_installment: noInstallment,
        max_installment: maxInstallment,
        user_name: user.displayName || user.username,
        user_address: 'Dracord',
        user_phone: '0000000000',
        merchant_ok_url:
          this.config.get<string>('PAYTR_OK_URL') ||
          'https://dracord.com.tr/settings/nitro?ok=1',
        merchant_fail_url:
          this.config.get<string>('PAYTR_FAIL_URL') ||
          'https://dracord.com.tr/settings/nitro?fail=1',
        timeout_limit: '30',
        currency,
        test_mode: testMode,
        lang: 'tr',
      });
      const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const json = (await res.json()) as { status?: string; token?: string; reason?: string };
      if (json.status === 'success' && json.token) {
        iframeToken = json.token;
      } else {
        throw new BadRequestException(
          json.reason || 'PayTR get-token başarısız',
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new ServiceUnavailableException(
        e instanceof Error ? e.message : 'PayTR bağlantı hatası',
      );
    }

    return {
      mode: 'paytr' as const,
      plan,
      merchantOid,
      iframeToken,
      iframeUrl: iframeToken
        ? `https://www.paytr.com/odeme/guvenli/${iframeToken}`
        : null,
    };
  }

  async subscribe(
    userId: string,
    plan: 'basic' | 'nitro',
    opts?: { paytrToken?: string; skipPaymentCheck?: boolean },
  ) {
    if (isNitroPaymentsEnabled(this.config) && !opts?.skipPaymentCheck) {
      if (!opts?.paytrToken) {
        throw new ServiceUnavailableException(
          'NITRO_PAYMENTS açık — önce /billing/nitro/checkout',
        );
      }
      if (opts.paytrToken.length < 8) {
        throw new BadRequestException('Geçersiz PayTR token');
      }
    }
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı yok');
    const settings = mergeClientSettings(user.clientSettings);
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 1);
    settings.billing.nitroPlan = plan;
    settings.billing.nitroExpiresAt = expires.toISOString();
    settings.billing.boostCredits = Math.max(
      settings.billing.boostCredits,
      plan === 'nitro' ? 2 : 1,
    );
    settings.billing.invoices = [
      {
        id: createId(),
        label: plan === 'nitro' ? 'Nitro' : 'Nitro Basic',
        amount: isNitroPaymentsEnabled(this.config) ? 'ödendi' : 'demo',
        at: new Date().toISOString(),
      },
      ...settings.billing.invoices,
    ].slice(0, 20);
    user.clientSettings = settings as unknown as Record<string, unknown>;
    await this.em.save(user);
    return { billing: settings.billing };
  }

  async cancel(userId: string) {
    const user = await this.em.findOne(User, { where: { id: userId } });
    if (!user) throw new BadRequestException('Kullanıcı yok');
    const settings = mergeClientSettings(user.clientSettings);
    settings.billing.nitroPlan = 'none';
    settings.billing.nitroExpiresAt = null;
    user.clientSettings = settings as unknown as Record<string, unknown>;
    await this.em.save(user);
    return { billing: settings.billing };
  }

  /** PayTR bildirim — imza doğrulamalı; merchant_oid = userId:plan[:ts] */
  async paytrCallback(body: Record<string, unknown>) {
    if (!isNitroPaymentsEnabled(this.config)) {
      return { status: 'ignored', reason: 'NITRO_PAYMENTS off' };
    }
    const merchantKey = this.config.get<string>('PAYTR_MERCHANT_KEY')?.trim();
    const merchantSalt = this.config.get<string>('PAYTR_MERCHANT_SALT')?.trim();
    if (!merchantKey || !merchantSalt) {
      return { status: 'failed', reason: 'keys missing' };
    }

    const merchantOid = String(body.merchant_oid ?? '');
    const status = String(body.status ?? '');
    const totalAmount = String(body.total_amount ?? '');
    const hash = String(body.hash ?? '');

    const ok = paytrVerifyCallback({
      merchantKey,
      merchantSalt,
      merchantOid,
      status,
      totalAmount,
      hash,
    });
    if (!ok) {
      return { status: 'failed', reason: 'bad hash' };
    }
    if (status !== 'success') {
      return { status: 'OK' };
    }

    const [userId, plan] = merchantOid.split(':');
    if (plan !== 'basic' && plan !== 'nitro') {
      return { status: 'failed', reason: 'bad oid' };
    }
    await this.subscribe(userId!, plan, { skipPaymentCheck: true });
    return { status: 'OK' };
  }
}
