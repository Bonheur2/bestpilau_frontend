// Ties a login to this browser, so a copied login token is useless anywhere else.
//
// At sign-in the browser creates a signing key pair. The PRIVATE half is marked non-extractable and
// kept in IndexedDB: scripts and dev tools can use it but nobody can read it out or copy it. The
// server stores only the public half. Every request then carries a short signature ("proof") over
// the session key and the time. Someone who copies the token has no key, so they cannot sign, and
// the server ends the session. See backend/src/services/sessions.js.
//
// Browsers without WebCrypto/IndexedDB (plain-HTTP pages, some private windows) simply sign in
// without a key and get the weaker protection of matching browser + operating system.

const DB_NAME = 'bp-device';
const STORE = 'keys';
const KEY_ID = 'signing';

export const deviceKeysSupported = () =>
  typeof window !== 'undefined' && typeof window.crypto?.subtle?.generateKey === 'function' && 'indexedDB' in window;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

const base64url = (buffer: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Creates this browser's key and returns the public half to send at sign-in, or null if unsupported. */
export async function createDeviceKey(): Promise<{ kty: string; crv: string; x: string; y: string } | null> {
  if (!deviceKeysSupported()) return null;
  try {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
    if (!kty || !crv || !x || !y) return null;
    await withStore('readwrite', (store) => store.put(pair.privateKey, KEY_ID));
    return { kty, crv, x, y };
  } catch {
    return null;
  }
}

export async function deleteDeviceKey() {
  if (!deviceKeysSupported()) return;
  try {
    await withStore('readwrite', (store) => store.delete(KEY_ID));
  } catch {}
}

// ---- Clock ----
// The server accepts proofs within a couple of minutes of its own time. Devices with a wrong clock
// (it happens on kitchen tablets) correct themselves from the server's time.
let clockOffset = 0;
export const syncClock = (serverTimeMs: number) => {
  if (Number.isFinite(serverTimeMs)) clockOffset = serverTimeMs - Date.now();
};
const serverNow = () => Date.now() + clockOffset;

const sessionKeyOf = (token: string): string | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.sid === 'string' ? payload.sid : null;
  } catch {
    return null;
  }
};

/** The X-Proof value for this token, or null when this browser has no key (an unprotected session). */
export async function signProof(token: string): Promise<string | null> {
  if (!deviceKeysSupported()) return null;
  const sid = sessionKeyOf(token);
  if (!sid) return null;
  try {
    const key = await withStore<CryptoKey | undefined>('readonly', (store) => store.get(KEY_ID));
    if (!key) return null;
    const timestamp = serverNow();
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${sid}.${timestamp}`));
    return `${timestamp}.${base64url(signature)}`;
  } catch {
    return null;
  }
}
