import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runUse } from '../src/commands/use.js';

const HEART_BODY = `---
name: zundamon
creator: tanaka
description: '明るく元気なずんだもん人格'
version: 1
---

# ずんだもん人格

あなたはずんだもんなのだ。
`;

describe('runUse', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('downloads and writes the heart file + SKILL.md when local file is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(HEART_BODY, { status: 200, headers: { 'Content-Type': 'text/markdown' } }),
    );

    const result = await runUse({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    expect(result.downloaded).toBe(true);
    expect(result.description).toBe('明るく元気なずんだもん人格');

    const heart = await readFile(join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md'), 'utf8');
    expect(heart).toBe(HEART_BODY);

    const skill = await readFile(join(tmp, '.claude/skills/heartcraft/SKILL.md'), 'utf8');
    expect(skill).toContain('**tanaka/zundamon.md**');
  });

  it('skips download when the heart file already exists locally', async () => {
    const existing = '---\nname: zundamon\n---\n\n# already here\n';
    const heartPath = join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md');
    await mkdir(dirname(heartPath), { recursive: true });
    await writeFile(heartPath, existing, 'utf8');

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await runUse({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    expect(result.downloaded).toBe(false);
    expect(result.description).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    // 既存の Heart 本体は触らない
    const heart = await readFile(heartPath, 'utf8');
    expect(heart).toBe(existing);

    // SKILL.md は新規生成されて参照が書き換わっている
    const skill = await readFile(join(tmp, '.claude/skills/heartcraft/SKILL.md'), 'utf8');
    expect(skill).toContain('**tanaka/zundamon.md**');
  });

  it('throws on 404 with a clear message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));

    await expect(
      runUse({ slug: 'noone/nothing', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Heart not found: noone\/nothing/);
  });

  it('throws on network failure with a friendly hint', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      runUse({ slug: 'tanaka/zundamon', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Cannot reach HeartCraftLab API/);
  });

  it('rejects invalid slug before calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      runUse({ slug: 'BAD-CASE/x', baseDir: tmp, apiUrl: 'http://stub' }),
    ).rejects.toThrowError(/Invalid user name/);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs telemetry when a download actually ran', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/installs')) {
        return new Response('', { status: 201 });
      }
      return new Response(HEART_BODY, { status: 200 });
    });

    await runUse({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    const telemetryCall = fetchSpy.mock.calls.find((call) => {
      const u = call[0];
      return typeof u === 'string' && u.includes('/api/installs');
    });
    expect(telemetryCall).toBeDefined();

    const [url, init] = telemetryCall as [string, RequestInit];
    expect(url).toBe('http://stub/api/installs');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.heart_id).toBe('tanaka/zundamon');
    expect(body.machine_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('does NOT POST telemetry when the download was skipped', async () => {
    const heartPath = join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md');
    await mkdir(dirname(heartPath), { recursive: true });
    await writeFile(heartPath, HEART_BODY, 'utf8');

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await runUse({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still succeeds when telemetry POST fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/installs')) {
        throw new Error('ECONNREFUSED');
      }
      return new Response(HEART_BODY, { status: 200 });
    });

    const result = await runUse({
      slug: 'tanaka/zundamon',
      baseDir: tmp,
      apiUrl: 'http://stub',
    });

    expect(result.downloaded).toBe(true);
    expect(result.description).toBe('明るく元気なずんだもん人格');
    const heart = await readFile(join(tmp, '.claude/skills/heartcraft/tanaka/zundamon.md'), 'utf8');
    expect(heart).toBe(HEART_BODY);
  });
});
