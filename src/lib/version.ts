import { readFile } from 'node:fs/promises';

/**
 * package.json から CLI version を読み出す。
 * - dist/lib/version.js から見て `../../package.json` がリポジトリルートの package.json に当たる。
 * - dev (tsx) / vitest 実行時も src/lib/version.ts から `../../package.json` がリポジトリルートを指す。
 */
export async function readCliVersion(): Promise<string> {
  const url = new URL('../../package.json', import.meta.url);
  const json = JSON.parse(await readFile(url, 'utf8')) as { version: string };
  return json.version;
}
