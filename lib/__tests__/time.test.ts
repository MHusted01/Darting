import { describe, expect, it } from '@jest/globals';
import { timeAgo } from '@/lib/time';

const NOW = '2026-06-08T15:00:00Z';

describe('timeAgo', () => {
  it('returns "just now" for < 60 seconds', () => {
    expect(timeAgo('2026-06-08T14:59:30Z', NOW)).toBe('just now');
  });

  it('returns minutes for < 60 minutes', () => {
    expect(timeAgo('2026-06-08T14:30:00Z', NOW)).toBe('30m ago');
  });

  it('returns "1m ago" for 1 minute', () => {
    expect(timeAgo('2026-06-08T14:59:00Z', NOW)).toBe('1m ago');
  });

  it('returns hours for < 24 hours', () => {
    expect(timeAgo('2026-06-08T12:00:00Z', NOW)).toBe('3h ago');
  });

  it('returns "1h ago" for 1 hour', () => {
    expect(timeAgo('2026-06-08T14:00:00Z', NOW)).toBe('1h ago');
  });

  it('returns days for < 7 days', () => {
    expect(timeAgo('2026-06-05T15:00:00Z', NOW)).toBe('3d ago');
  });

  it('returns "1d ago" for 1 day', () => {
    expect(timeAgo('2026-06-07T15:00:00Z', NOW)).toBe('1d ago');
  });

  it('returns weeks for < 30 days', () => {
    expect(timeAgo('2026-05-25T15:00:00Z', NOW)).toBe('2w ago');
  });

  it('returns months for >= 30 days', () => {
    expect(timeAgo('2026-04-08T15:00:00Z', NOW)).toBe('2mo ago');
  });
});
