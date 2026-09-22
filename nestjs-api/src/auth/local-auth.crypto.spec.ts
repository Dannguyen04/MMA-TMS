import {
  createOpaqueToken,
  hashLocalPassword,
  hashOpaqueToken,
  verifyLocalPassword,
} from './local-auth.crypto.js';

describe('local auth crypto', () => {
  it('hashes passwords with a unique scrypt salt', async () => {
    const first = await hashLocalPassword('strong-password');
    const second = await hashLocalPassword('strong-password');

    expect(first).not.toBe(second);
    await expect(verifyLocalPassword('strong-password', first)).resolves.toBe(
      true,
    );
    await expect(verifyLocalPassword('wrong-password', first)).resolves.toBe(
      false,
    );
  });

  it('creates opaque tokens and stable one-way hashes', () => {
    const token = createOpaqueToken();

    expect(token).toHaveLength(43);
    expect(hashOpaqueToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });
});
