import { describe, expect, it } from 'vitest';
import { checkVerifier, createVerifier, decryptString, deriveKey, encryptString, randomSaltBase64, reencryptItems } from './vault-crypto';

describe('vault crypto', () => {
  it('round-trips a secret and checks a passphrase', async () => {
    const salt = randomSaltBase64();
    const key = await deriveKey('correct horse battery', salt);
    const cipher = await encryptString('hunter2', key);
    expect(await decryptString(cipher, key)).toBe('hunter2');
    const verifier = await createVerifier(key);
    expect(await checkVerifier(verifier, key)).toBe(true);
    expect(await checkVerifier(verifier, await deriveKey('wrong passphrase', salt))).toBe(false);
  });

  it('moves items to a new key, leaving empty fields empty', async () => {
    const oldKey = await deriveKey('old shared phrase', randomSaltBase64());
    const newKey = await deriveKey('new shared phrase', randomSaltBase64());
    const items = [
      { id: 'a', secret_cipher: await encryptString('pw-a', oldKey), notes_cipher: await encryptString('note-a', oldKey) },
      { id: 'b', secret_cipher: await encryptString('pw-b', oldKey), notes_cipher: null },
    ];
    const moved = await reencryptItems(items, oldKey, newKey);
    expect(moved.map(m => m.id)).toEqual(['a', 'b']);
    expect(await decryptString(moved[0].secret_cipher!, newKey)).toBe('pw-a');
    expect(await decryptString(moved[0].notes_cipher!, newKey)).toBe('note-a');
    expect(moved[1].notes_cipher).toBeNull();
    await expect(decryptString(moved[0].secret_cipher!, oldKey)).rejects.toBeTruthy();
  });

  it('refuses the whole batch when one item is not under the old key', async () => {
    const oldKey = await deriveKey('old', randomSaltBase64());
    const other = await deriveKey('other', randomSaltBase64());
    const newKey = await deriveKey('new', randomSaltBase64());
    const items = [
      { id: 'a', secret_cipher: await encryptString('pw-a', oldKey) },
      { id: 'b', secret_cipher: await encryptString('pw-b', other) },
    ];
    await expect(reencryptItems(items, oldKey, newKey)).rejects.toThrow(/nothing was changed/);
  });
});
