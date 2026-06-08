import { describe, expect, it } from '@jest/globals';
import { parseMentions } from '@/lib/mentions';

describe('parseMentions', () => {
  it('extracts a single mention', () => {
    expect(parseMentions('gg @marcus!')).toEqual(['marcus']);
  });

  it('extracts multiple mentions', () => {
    expect(parseMentions('gg @marcus and @sam!')).toEqual(['marcus', 'sam']);
  });

  it('deduplicates repeated handles', () => {
    expect(parseMentions('@alice @alice @alice')).toEqual(['alice']);
  });

  it('returns lowercase handles', () => {
    expect(parseMentions('@Alice @BOB')).toEqual(['alice', 'bob']);
  });

  it('returns empty array for empty body', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns empty array when no mentions', () => {
    expect(parseMentions('just a regular sentence')).toEqual([]);
  });

  it('ignores email-like patterns', () => {
    expect(parseMentions('email me at user@example.com')).toEqual([]);
  });

  it('handles mention at start of string', () => {
    expect(parseMentions('@marcus good game')).toEqual(['marcus']);
  });

  it('handles mention at end of string', () => {
    expect(parseMentions('good game @marcus')).toEqual(['marcus']);
  });

  it('ignores handles shorter than 2 characters', () => {
    expect(parseMentions('@a is too short')).toEqual([]);
  });

  it('handles underscores in handles', () => {
    expect(parseMentions('@dart_king scored!')).toEqual(['dart_king']);
  });

  it('handles mention immediately after non-word punctuation', () => {
    expect(parseMentions('nice! @marcus')).toEqual(['marcus']);
  });
});
