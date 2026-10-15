import { describe, expect, it } from 'vitest';
import { hashPassword, safeEqual, verifyPassword } from './password.js';

describe('password hashing and verification', () => {
  it('hashes passwords and verifies correct input', async () => {
    const raw = 'CorrectHorseBatteryStaple123!';
    const hash = await hashPassword(raw);
    expect(hash).toMatch(/^\$argon2id\$/);

    const match = await verifyPassword(hash, raw);
    expect(match).toBe(true);

    const wrong = await verifyPassword(hash, 'WrongPassword123!');
    expect(wrong).toBe(false);
  });

  it('performs constant-time safe string equality', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
