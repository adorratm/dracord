'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Logo } from './Logo';

export interface LoginScreenProps {
  showApple?: boolean;
  onGoogleLogin?: () => void;
  onAppleLogin?: () => void;
  loading?: boolean;
  errorMessage?: string;
  /** Logo yerine özel hero (ör. Draco maskot) */
  hero?: ReactNode;
  className?: string;
}

export function LoginScreen({
  showApple = false,
  onGoogleLogin,
  onAppleLogin,
  loading,
  errorMessage,
  hero,
  className,
}: LoginScreenProps) {
  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center bg-surface-container-lowest px-space-lg py-space-xl',
        className,
      )}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-space-xl">
        <div className="flex flex-col items-center gap-space-md text-center">
          {hero ?? <Logo size={96} showBackground className="shadow-float rounded-2xl" />}
          <h1 className="font-headline-xl text-headline-xl text-on-surface">Dracord&apos;a hoş geldin</h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
            Dracula temalı topluluk sohbeti. Hesabınla giriş yap ve sunucularına katıl.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="w-full px-space-md py-space-sm rounded-lg bg-error-container/30 border border-error text-on-error-container font-body-sm text-body-sm"
          >
            {errorMessage}
          </div>
        )}

        <div className="w-full flex flex-col gap-space-sm">
          <button
            type="button"
            disabled={loading}
            onClick={onGoogleLogin}
            className="w-full flex items-center justify-center gap-space-sm h-11 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-headline-md text-headline-md transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
            Google ile giriş yap
          </button>

          {showApple && (
            <button
              type="button"
              disabled={loading}
              onClick={onAppleLogin}
              className="w-full flex items-center justify-center gap-space-sm h-11 rounded-lg bg-on-surface text-surface hover:opacity-90 font-headline-md text-headline-md transition-opacity disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[22px]">phone_iphone</span>
              Apple ile giriş yap
            </button>
          )}
        </div>

        <p className="font-label-sm text-label-sm text-outline text-center max-w-xs">
          Devam ederek Dracord Hizmet Şartları&apos;nı ve Gizlilik Politikası&apos;nı kabul etmiş olursun.
        </p>
      </div>
    </div>
  );
}
