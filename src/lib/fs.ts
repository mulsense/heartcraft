import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** dirname を mkdir -p してからファイルを書き出す */
export async function writeFileEnsureDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

/**
 * ファイルを削除する。存在しなければ何もしない（冪等）。
 * @returns 実際に削除したら true、元から存在しなければ false
 */
export async function removeFileIfExists(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw err;
  }
}
