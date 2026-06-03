import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../src/lib/auth';
describe('auth tokens', () => {
  it('should sign and verify a token successfully', async () => {
    const token = await signToken({
      sub: 'user-1',
      email: 'test@example.com',
      kind: 'BUYER',
      roles: ['buyer']
    });
    expect(token).toBeTruthy();
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe('user-1');
  });
  it('should return null for an invalid token', async () => {
    const payload = await verifyToken('not.a.valid.token');
    expect(payload).toBeNull();
  });
  it('should return null for a tampered token', async () => {
    const token = await signToken({
      sub: 'user-2',
      email: 'u@test.com',
      kind: 'BUYER',
      roles: []
    });
    const parts = token.split('.');
    parts[2] = parts[2].split('').reverse().join('');
    const payload = await verifyToken(parts.join('.'));
    expect(payload).toBeNull();
  });
});
