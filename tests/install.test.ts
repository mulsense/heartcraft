import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInstall } from '../src/commands/install.js';

const HEART_BODY = `---
name: zundamon
creator: tanaka
description: '明るく元気なずんだもん人格'
version: 1
---

# ずんだもん人格

あなたはずんだもんなのだ。
`;

describe('runInstall', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes the heart file and SKILL.md', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(HEART_BODY, { status: 200, headers: { 'Content-Type': 'text/markdown' } }),
    );

    const result = await runInstall({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    expect(result.description).toBe('明るく元気なずんだもん人格');

    const heart = await readFile(join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md'), 'utf8');
    expect(heart).toBe(HEART_BODY);

    const skill = await readFile(join(tmp, '.claude/skills/heartcraft/SKILL.md'), 'utf8');
    expect(skill).toContain('**tanaka/zundamon.md**');
  });

  it('throws on 404 with a clear message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    await expect(
      runInstall({ slug: 'noone/nothing', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Heart not found: noone\/nothing/);
  });

  it('throws on network failure with a friendly hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      runInstall({ slug: 'tanaka/zundamon', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Cannot reach HeartCraftLab API/);
  });

  it('rejects invalid slug before calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      runInstall({ slug: 'BAD-CASE/x', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Invalid user name/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
