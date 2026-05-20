import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runClear } from '../src/commands/clear.js';

describe('runClear', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-clear-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('writes a SKILL.md with the inactive message when no agent detected (Claude Code fallback)', async () => {
    const result = await runClear({ baseDir: tmp });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agent).toBe('claude-code');
    expect(result.agents[0].activationPaths[0]).toBe(
      join(tmp, '.claude/skills/heartcraft/SKILL.md'),
    );

    const skill = await readFile(result.agents[0].activationPaths[0], 'utf8');
    expect(skill).toContain('現在アクティブな Heart はありません');
    expect(skill).not.toMatch(/\*\*[a-z0-9_-]+\/[a-z0-9_-]+\.md\*\*/);
  });

  it('overwrites an existing SKILL.md and leaves Heart files intact', async () => {
    const heartPath = join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md');
    await mkdir(dirname(heartPath), { recursive: true });
    await writeFile(heartPath, 'heart body', 'utf8');
    const skillMdPath = join(tmp, '.claude/skills/heartcraft/SKILL.md');
    await writeFile(skillMdPath, '*previous skill*', 'utf8');

    await runClear({ baseDir: tmp });

    const skill = await readFile(skillMdPath, 'utf8');
    expect(skill).toContain('現在アクティブな Heart はありません');
    expect(skill).not.toContain('previous skill');

    // 配置済み Heart 本体は残す
    const heart = await readFile(heartPath, 'utf8');
    expect(heart).toBe('heart body');
  });

  it('clears activation across multiple detected agents', async () => {
    await mkdir(join(tmp, '.claude'), { recursive: true });
    await mkdir(join(tmp, '.cursor'), { recursive: true });

    const result = await runClear({ baseDir: tmp });

    expect(result.agents.map((a) => a.agent)).toEqual(['claude-code', 'cursor']);

    const skill = await readFile(join(tmp, '.claude/skills/heartcraft/SKILL.md'), 'utf8');
    expect(skill).toContain('現在アクティブな Heart はありません');

    const mdc = await readFile(join(tmp, '.cursor/rules/heartcraft.mdc'), 'utf8');
    expect(mdc).toContain('現在アクティブな Heart はありません');
    expect(mdc).toContain('alwaysApply: true');
  });
});
