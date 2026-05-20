import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_ADAPTERS,
  claudeCodeAdapter,
  copilotAdapter,
  cursorAdapter,
  detectAgents,
  findCachedHeart,
  geminiCliAdapter,
} from '../src/lib/agents.js';

describe('agent adapters - detect', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-agents-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('Claude Code: detects CLAUDE.md', async () => {
    await writeFile(join(tmp, 'CLAUDE.md'), '# project', 'utf8');
    expect(await claudeCodeAdapter.detect(tmp)).toBe(true);
  });

  it('Claude Code: detects .claude/', async () => {
    await mkdir(join(tmp, '.claude'), { recursive: true });
    expect(await claudeCodeAdapter.detect(tmp)).toBe(true);
  });

  it('Cursor: detects .cursor/', async () => {
    await mkdir(join(tmp, '.cursor'), { recursive: true });
    expect(await cursorAdapter.detect(tmp)).toBe(true);
  });

  it('Cursor: detects .cursorrules', async () => {
    await writeFile(join(tmp, '.cursorrules'), '# rules', 'utf8');
    expect(await cursorAdapter.detect(tmp)).toBe(true);
  });

  it('Copilot: detects .github/copilot-instructions.md', async () => {
    await mkdir(join(tmp, '.github'), { recursive: true });
    await writeFile(join(tmp, '.github/copilot-instructions.md'), '# inst', 'utf8');
    expect(await copilotAdapter.detect(tmp)).toBe(true);
  });

  it('Copilot: detects .github/instructions/', async () => {
    await mkdir(join(tmp, '.github/instructions'), { recursive: true });
    expect(await copilotAdapter.detect(tmp)).toBe(true);
  });

  it('Gemini CLI: detects GEMINI.md', async () => {
    await writeFile(join(tmp, 'GEMINI.md'), '# project', 'utf8');
    expect(await geminiCliAdapter.detect(tmp)).toBe(true);
  });

  it('Gemini CLI: detects .gemini/', async () => {
    await mkdir(join(tmp, '.gemini'), { recursive: true });
    expect(await geminiCliAdapter.detect(tmp)).toBe(true);
  });

  it('returns false when no markers exist', async () => {
    for (const adapter of ALL_ADAPTERS) {
      expect(await adapter.detect(tmp)).toBe(false);
    }
  });
});

describe('detectAgents', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-detect-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns multiple agents when multiple markers exist', async () => {
    await mkdir(join(tmp, '.claude'), { recursive: true });
    await mkdir(join(tmp, '.cursor'), { recursive: true });

    const detected = await detectAgents(tmp);
    const names = detected.map((a) => a.name);
    expect(names).toEqual(['claude-code', 'cursor']);
  });

  it('falls back to Claude Code when no agent detected', async () => {
    const detected = await detectAgents(tmp);
    expect(detected).toHaveLength(1);
    expect(detected[0].name).toBe('claude-code');
  });

  it('returns all 4 agents when all markers exist', async () => {
    await writeFile(join(tmp, 'CLAUDE.md'), '', 'utf8');
    await mkdir(join(tmp, '.cursor'), { recursive: true });
    await mkdir(join(tmp, '.github/instructions'), { recursive: true });
    await writeFile(join(tmp, 'GEMINI.md'), '', 'utf8');

    const detected = await detectAgents(tmp);
    expect(detected.map((a) => a.name)).toEqual(['claude-code', 'cursor', 'copilot', 'gemini-cli']);
  });
});

describe('findCachedHeart', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-cached-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('returns null when no agent has the heart', async () => {
    const result = await findCachedHeart(tmp, { user: 'u', name: 'n' }, ALL_ADAPTERS);
    expect(result).toBeNull();
  });

  it("returns the Claude Code path when only Claude Code has it", async () => {
    const path = join(tmp, '.claude/skills/heartcraft/u/n.md');
    await mkdir(join(tmp, '.claude/skills/heartcraft/u'), { recursive: true });
    await writeFile(path, 'body', 'utf8');

    const result = await findCachedHeart(tmp, { user: 'u', name: 'n' }, ALL_ADAPTERS);
    expect(result).toBe(path);
  });

  it('returns the first agent path that has it', async () => {
    const cursorPath = join(tmp, '.cursor/rules/heartcraft/u/n.md');
    await mkdir(join(tmp, '.cursor/rules/heartcraft/u'), { recursive: true });
    await writeFile(cursorPath, 'body', 'utf8');

    // adapter 順は ALL_ADAPTERS の順（claude → cursor → ...）
    const result = await findCachedHeart(tmp, { user: 'u', name: 'n' }, ALL_ADAPTERS);
    expect(result).toBe(cursorPath);
  });
});
