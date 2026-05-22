import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runClear } from '../src/commands/clear.js';

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('runClear', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-clear-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('deletes the SKILL.md of a detected Claude Code project', async () => {
    const skillMdPath = join(tmp, '.claude/skills/heartcraft/SKILL.md');
    await mkdir(dirname(skillMdPath), { recursive: true });
    await writeFile(skillMdPath, '# some skill', 'utf8');

    const result = await runClear({ baseDir: tmp });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agent).toBe('claude-code');
    expect(result.agents[0].deletedPaths).toEqual([skillMdPath]);
    expect(await exists(skillMdPath)).toBe(false);
  });

  it('deletes the activation file but leaves Heart cache files intact', async () => {
    const heartPath = join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md');
    await mkdir(dirname(heartPath), { recursive: true });
    await writeFile(heartPath, 'heart body', 'utf8');
    const skillMdPath = join(tmp, '.claude/skills/heartcraft/SKILL.md');
    await writeFile(skillMdPath, '# some skill', 'utf8');

    await runClear({ baseDir: tmp });

    // activation ファイルは削除
    expect(await exists(skillMdPath)).toBe(false);
    // 人格本体キャッシュは残す
    expect(await readFile(heartPath, 'utf8')).toBe('heart body');
  });

  it('is idempotent and falls back to Claude Code when nothing exists', async () => {
    const result = await runClear({ baseDir: tmp });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].agent).toBe('claude-code');
    expect(result.agents[0].deletedPaths).toEqual([]);
  });

  it('clears activation across multiple detected agents', async () => {
    const skillMdPath = join(tmp, '.claude/skills/heartcraft/SKILL.md');
    await mkdir(dirname(skillMdPath), { recursive: true });
    await writeFile(skillMdPath, '# some skill', 'utf8');
    const mdcPath = join(tmp, '.cursor/rules/heartcraft.mdc');
    await mkdir(dirname(mdcPath), { recursive: true });
    await writeFile(mdcPath, '# some rule', 'utf8');

    const result = await runClear({ baseDir: tmp });

    expect(result.agents.map((a) => a.agent)).toEqual(['claude-code', 'cursor']);
    expect(await exists(skillMdPath)).toBe(false);
    expect(await exists(mdcPath)).toBe(false);
  });
});
