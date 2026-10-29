import { createRemoteJWKSet, jwtVerify } from 'jose';

const appleJwks = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys'),
);

export type AppleIdTokenClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  iss: string;
  aud: string | string[];
};

/** Apple identity token (id_token) doğrula — Services ID / App ID audience */
export async function verifyAppleIdToken(
  idToken: string,
  audience: string,
): Promise<AppleIdTokenClaims> {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: 'https://appleid.apple.com',
    audience,
  });
  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  if (!sub) throw new Error('Apple token: sub yok');
  return {
    sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: payload.email_verified as boolean | string | undefined,
    iss: String(payload.iss ?? ''),
    aud: payload.aud as string | string[],
  };
}
