// Client-side vault encryption using the Web Crypto API.
// Secrets are encrypted in the browser with an AES-GCM key derived from the
// user's vault passphrase via PBKDF2. The passphrase and derived key never
// leave the browser, so the database only ever stores ciphertext.

const VERIFIER_PLAINTEXT = 'studio-os-vault-ok';
const PBKDF2_ITERATIONS = 250_000;

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function randomSaltBase64(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToBase64(salt.buffer);
}

// Derive an AES-GCM key from the passphrase + salt.
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBuf(saltB64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a string → "iv:ciphertext" (both base64).
export async function encryptString(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );
  return `${bufToBase64(iv.buffer)}:${bufToBase64(cipher)}`;
}

// Decrypt an "iv:ciphertext" string back to plaintext.
export async function decryptString(payload: string, key: CryptoKey): Promise<string> {
  const [ivB64, cipherB64] = payload.split(':');
  if (!ivB64 || !cipherB64) throw new Error('Malformed ciphertext');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuf(ivB64) },
    key,
    base64ToBuf(cipherB64)
  );
  return new TextDecoder().decode(plain);
}

// Create a verifier token (encrypt a known string) stored at vault setup.
export async function createVerifier(key: CryptoKey): Promise<string> {
  return encryptString(VERIFIER_PLAINTEXT, key);
}

// Confirm a passphrase-derived key matches the stored verifier.
export async function checkVerifier(verifier: string, key: CryptoKey): Promise<boolean> {
  try {
    const out = await decryptString(verifier, key);
    return out === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}
