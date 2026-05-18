import { describe, expect, it } from 'vitest';
import { extractDescription, renderSkillMd } from '../src/lib/skill.js';

describe('renderSkillMd', () => {
  it('includes the active heart path when given', () => {
    const out = renderSkillMd({ user: 'tanaka', name: 'zundamon' });
    expect(out).toContain('**tanaka/zundamon.md**');
    expect(out).toContain('name: heartcraft');
  });

  it('falls back to inactive message when null', () => {
    const out = renderSkillMd(null);
    expect(out).toContain('現在アクティブな Heart はありません');
  });
});

describe('extractDescription', () => {
  it('extracts plain description', () => {
    const md = '---\nname: x\ndescription: hello world\n---\nbody';
    expect(extractDescription(md)).toBe('hello world');
  });

  it('strips surrounding single quotes (Yaml::dump output)', () => {
    const md = "---\nname: x\ndescription: 'quoted desc'\n---\nbody";
    expect(extractDescription(md)).toBe('quoted desc');
  });

  it('returns empty when no frontmatter', () => {
    expect(extractDescription('just body')).toBe('');
  });

  it('returns empty when description missing', () => {
    expect(extractDescription('---\nname: x\n---\nbody')).toBe('');
  });
});
