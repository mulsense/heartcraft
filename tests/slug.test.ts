import { describe, expect, it } from 'vitest';
import { parseSlug } from '../src/lib/slug.js';

describe('parseSlug', () => {
  it('parses a valid slug', () => {
    expect(parseSlug('tanaka/zundamon')).toEqual({ user: 'tanaka', name: 'zundamon' });
  });

  it('allows digits, dash, underscore', () => {
    expect(parseSlug('user-1/heart_v2')).toEqual({ user: 'user-1', name: 'heart_v2' });
  });

  it('rejects missing slash', () => {
    expect(() => parseSlug('tanaka')).toThrowError(/Expected format/);
  });

  it('rejects empty user or name', () => {
    expect(() => parseSlug('/zundamon')).toThrowError(/Expected format/);
    expect(() => parseSlug('tanaka/')).toThrowError(/Expected format/);
  });

  it('rejects more than one slash', () => {
    expect(() => parseSlug('a/b/c')).toThrowError(/Expected format/);
  });

  it('rejects uppercase', () => {
    expect(() => parseSlug('Tanaka/zundamon')).toThrowError(/Invalid user name/);
    expect(() => parseSlug('tanaka/Zundamon')).toThrowError(/Invalid heart name/);
  });

  it('rejects leading dash or underscore', () => {
    expect(() => parseSlug('-tanaka/zundamon')).toThrowError(/Invalid user name/);
    expect(() => parseSlug('tanaka/_zundamon')).toThrowError(/Invalid heart name/);
  });
});
