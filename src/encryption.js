const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KEY_NAME = 'wealth-accelerator-key';

async function getKeyMaterial(passphrase) {
  return crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
}

async function deriveKey(passphrase) {
  const keyMaterial = await getKeyMaterial(passphrase);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KEY_NAME),
      iterations: 120000,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptData(data, passphrase) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase);
  const encoded = encoder.encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipher))
  };
}

export async function decryptData(payload, passphrase) {
  const iv = new Uint8Array(payload.iv);
  const data = new Uint8Array(payload.data);
  const key = await deriveKey(passphrase);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(decoder.decode(decrypted));
}

export async function ensureKey(passphrase) {
  await deriveKey(passphrase);
}
