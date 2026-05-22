import { describe, expect, it } from 'vitest';
import { formatUseResult } from '../src/commands/use.js';
import type { UseAgentResult, UseResult } from '../src/commands/use.js';

const claudeAgent: UseAgentResult = {
  agent: 'claude-code',
  displayName: 'Claude Code',
  heartPath: '/work/.claude/skills/heartcraft/master/zundamon.md',
  activationPaths: ['/work/.claude/skills/heartcraft/SKILL.md'],
};

function makeResult(over: Partial<UseResult> = {}): UseResult {
  return {
    agents: [claudeAgent],
    downloaded: true,
    name: 'ずんだもん',
    description: '明るく元気なずんだもん人格',
    ...over,
  };
}

describe('formatUseResult', () => {
  it('builds an install headline with the character name and slug', () => {
    const out = formatUseResult(makeResult(), 'master/zundamon', '/work');
    expect(out.headline).toBe('ずんだもん (master/zundamon) installed successfully!');
  });

  it('uses "switched!" when the download was skipped', () => {
    const out = formatUseResult(
      makeResult({ downloaded: false }),
      'master/zundamon',
      '/work',
    );
    expect(out.headline).toBe('ずんだもん (master/zundamon) switched!');
  });

  it('falls back to the slug alone when there is no character name', () => {
    const out = formatUseResult(
      makeResult({ name: '' }),
      'master/zundamon',
      '/work',
    );
    expect(out.headline).toBe('master/zundamon installed successfully!');
  });

  it('returns the heart file path relative to cwd, not absolute', () => {
    const out = formatUseResult(makeResult(), 'master/zundamon', '/work');
    expect(out.paths).toEqual(['.claude/skills/heartcraft/master/zundamon.md']);
  });

  it('returns one relative path per detected agent', () => {
    const cursorAgent: UseAgentResult = {
      agent: 'cursor',
      displayName: 'Cursor',
      heartPath: '/work/.cursor/rules/heartcraft/master/zundamon.md',
      activationPaths: ['/work/.cursor/rules/heartcraft.mdc'],
    };
    const out = formatUseResult(
      makeResult({ agents: [claudeAgent, cursorAgent] }),
      'master/zundamon',
      '/work',
    );
    expect(out.paths).toEqual([
      '.claude/skills/heartcraft/master/zundamon.md',
      '.cursor/rules/heartcraft/master/zundamon.md',
    ]);
  });
});
