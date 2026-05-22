import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { removeFileIfExists } from '../src/lib/fs.js';

describe('removeFileIfExists', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'heartcraft-fs-test-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('deletes an existing file and returns true', async () => {
    const path = join(tmp, 'target.md');
    await writeFile(path, 'content', 'utf8');

    const removed = await removeFileIfExists(path);

    expect(removed).toBe(true);
    await expect(stat(path)).rejects.toThrow();
  });

  it('returns false when the file does not exist', async () => {
    const removed = await removeFileIfExists(join(tmp, 'missing.md'));
    expect(removed).toBe(false);
  });
});
