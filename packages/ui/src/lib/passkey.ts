/**
 * E1 — tarayıcı tarafı passkey yardımcıları (ek kütüphane yok).
 * Modern tarayıcılarda PublicKeyCredential.parse*FromJSON + credential.toJSON kullanılır;
 * yoksa base64url dönüşümleri elle yapılır.
 */

type Json = Record<string, unknown>;

const b64uToBuf = (s: string): ArrayBuffer => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const bufToB64u = (b: ArrayBuffer | null | undefined): string | undefined => {
  if (!b) return undefined;
  const u = new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

type PKC = typeof PublicKeyCredential & {
  parseCreationOptionsFromJSON?: (o: Json) => PublicKeyCredentialCreationOptions;
  parseRequestOptionsFromJSON?: (o: Json) => PublicKeyCredentialRequestOptions;
};

/** Bu ortam passkey destekliyor mu (masaüstü uygulaması file:// kökeninde desteklenmez) */
export function passkeySupported(): boolean {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || !navigator.credentials) return false;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return false;
  return true;
}

function creationOptions(o: Json): PublicKeyCredentialCreationOptions {
  const P = window.PublicKeyCredential as PKC;
  if (P.parseCreationOptionsFromJSON) return P.parseCreationOptionsFromJSON(o);
  const user = o.user as Json;
  return {
    ...(o as unknown as PublicKeyCredentialCreationOptions),
    challenge: b64uToBuf(String(o.challenge)),
    user: { ...(user as unknown as PublicKeyCredentialUserEntity), id: b64uToBuf(String(user.id)) },
    excludeCredentials: ((o.excludeCredentials as Json[] | undefined) ?? []).map((c) => ({
      type: 'public-key' as const,
      id: b64uToBuf(String(c.id)),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  };
}

function requestOptions(o: Json): PublicKeyCredentialRequestOptions {
  const P = window.PublicKeyCredential as PKC;
  if (P.parseRequestOptionsFromJSON) return P.parseRequestOptionsFromJSON(o);
  return {
    ...(o as unknown as PublicKeyCredentialRequestOptions),
    challenge: b64uToBuf(String(o.challenge)),
    allowCredentials: ((o.allowCredentials as Json[] | undefined) ?? []).map((c) => ({
      type: 'public-key' as const,
      id: b64uToBuf(String(c.id)),
      transports: c.transports as AuthenticatorTransport[] | undefined,
    })),
  };
}

function credentialJson(c: PublicKeyCredential): Json {
  const withJson = c as PublicKeyCredential & { toJSON?: () => Json };
  if (typeof withJson.toJSON === 'function') return withJson.toJSON() as unknown as Json;
  const r = c.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse & { getTransports?: () => string[] };
  const base = { id: c.id, rawId: bufToB64u(c.rawId), type: c.type, clientExtensionResults: c.getClientExtensionResults(), authenticatorAttachment: c.authenticatorAttachment ?? undefined };
  if ('attestationObject' in r && r.attestationObject) {
    return {
      ...base,
      response: { clientDataJSON: bufToB64u(r.clientDataJSON), attestationObject: bufToB64u(r.attestationObject), transports: r.getTransports?.() ?? [] },
    };
  }
  return {
    ...base,
    response: {
      clientDataJSON: bufToB64u(r.clientDataJSON),
      authenticatorData: bufToB64u(r.authenticatorData),
      signature: bufToB64u(r.signature),
      userHandle: bufToB64u(r.userHandle),
    },
  };
}

function friendlyError(e: unknown): Error {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return new Error('İşlem iptal edildi ya da süresi doldu.');
  if (name === 'InvalidStateError') return new Error('Bu cihazdaki passkey zaten kayıtlı.');
  if (name === 'SecurityError') return new Error('Bu adreste passkey kullanılamıyor.');
  return e instanceof Error ? e : new Error('Passkey işlemi başarısız');
}

export type PasskeyClient = {
  passkeyRegisterOptions(): Promise<{ options: Json; state: string }>;
  passkeyRegisterVerify(state: string, response: unknown, name?: string): Promise<unknown>;
  passkeyLoginOptions(): Promise<{ options: Json; state: string }>;
  passkeyLoginVerify(state: string, response: unknown): Promise<unknown>;
};

export async function registerPasskey(client: PasskeyClient, name?: string) {
  const { options, state } = await client.passkeyRegisterOptions();
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.create({ publicKey: creationOptions(options) })) as PublicKeyCredential | null;
  } catch (e) {
    throw friendlyError(e);
  }
  if (!cred) throw new Error('Passkey oluşturulmadı');
  return client.passkeyRegisterVerify(state, credentialJson(cred), name);
}

export async function loginWithPasskey<T>(
  client: Omit<PasskeyClient, 'passkeyLoginVerify'> & { passkeyLoginVerify(state: string, response: unknown): Promise<T> },
): Promise<T> {
  const { options, state } = await client.passkeyLoginOptions();
  let cred: PublicKeyCredential | null;
  try {
    cred = (await navigator.credentials.get({ publicKey: requestOptions(options) })) as PublicKeyCredential | null;
  } catch (e) {
    throw friendlyError(e);
  }
  if (!cred) throw new Error('Passkey seçilmedi');
  return client.passkeyLoginVerify(state, credentialJson(cred));
}
