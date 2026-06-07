import { describe, it, expect } from '@jest/globals';
import { isValidUsername } from '@/lib/validation';

describe('isValidUsername', () => {
  it('accepts a 3-character alphanumeric username', () => {
    expect(isValidUsername('abc')).toBe(true);
  });

  it('accepts a 20-character username', () => {
    expect(isValidUsername('a'.repeat(20))).toBe(true);
  });

  it('accepts underscores', () => {
    expect(isValidUsername('dart_king_99')).toBe(true);
  });

  it('accepts digits', () => {
    expect(isValidUsername('user123')).toBe(true);
  });

  it('rejects a 2-character username (too short)', () => {
    expect(isValidUsername('ab')).toBe(false);
  });

  it('rejects a 21-character username (too long)', () => {
    expect(isValidUsername('a'.repeat(21))).toBe(false);
  });

  it('rejects spaces', () => {
    expect(isValidUsername('bad name')).toBe(false);
  });

  it('rejects hyphens', () => {
    expect(isValidUsername('has-hyphen')).toBe(false);
  });

  it('rejects dots', () => {
    expect(isValidUsername('user.name')).toBe(false);
  });

  it('rejects special characters', () => {
    expect(isValidUsername('user!')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidUsername('')).toBe(false);
  });
});
