import { createHmac } from 'crypto';

/** PayTR bildirim imzası (merchant_oid + merchant_salt + status + total_amount) */
export function paytrVerifyCallback(opts: {
  merchantKey: string;
  merchantSalt: string;
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): boolean {
  const raw =
    opts.merchantOid +
    opts.merchantSalt +
    opts.status +
    opts.totalAmount;
  const expected = createHmac('sha256', opts.merchantKey)
    .update(raw)
    .digest('base64');
  return expected === opts.hash;
}

/** iFrame token için PayTR get-token isteği gövdesi hash’i */
export function paytrPaymentHash(opts: {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: string;
  userBasket: string;
  noInstallment: string;
  maxInstallment: string;
  currency: string;
  testMode: string;
  merchantSalt: string;
  merchantKey: string;
}): string {
  const hashStr =
    opts.merchantId +
    opts.userIp +
    opts.merchantOid +
    opts.email +
    opts.paymentAmount +
    opts.userBasket +
    opts.noInstallment +
    opts.maxInstallment +
    opts.currency +
    opts.testMode +
    opts.merchantSalt;
  return createHmac('sha256', opts.merchantKey)
    .update(hashStr)
    .digest('base64');
}
