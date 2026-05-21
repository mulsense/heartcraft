import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** dirname を mkdir -p してからファイルを書き出す */
export async function writeFileEnsureDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}
