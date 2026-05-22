import { describe, expect, it } from 'vitest';
import { colorEnabled, green } from '../src/lib/color.js';

describe('green', () => {
  it('wraps text in the ANSI green sequence when enabled', () => {
    expect(green('hi', true)).toBe('\x1b[32mhi\x1b[0m');
  });

  it('returns text unchanged when disabled', () => {
    expect(green('hi', false)).toBe('hi');
  });
});

describe('colorEnabled', () => {
  it('is true on a TTY with no NO_COLOR', () => {
    expect(colorEnabled({ isTTY: true }, {})).toBe(true);
  });

  it('is false when NO_COLOR is set', () => {
    expect(colorEnabled({ isTTY: true }, { NO_COLOR: '1' })).toBe(false);
  });

  it('is false when NO_COLOR is present but empty (presence wins)', () => {
    expect(colorEnabled({ isTTY: true }, { NO_COLOR: '' })).toBe(false);
  });

  it('is false when the stream is not a TTY', () => {
    expect(colorEnabled({ isTTY: false }, {})).toBe(false);
  });
});
