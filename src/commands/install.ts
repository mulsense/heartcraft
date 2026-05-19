import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseSlug } from '../lib/slug.js';
import { extractDescription, renderSkillMd } from '../lib/skill.js';
import { recordInstall } from '../lib/telemetry.js';
import { readCliVersion } from '../lib/version.js';

const DEFAULT_API_URL = 'http://localhost';
const SKILLS_SUBPATH = '.claude/skills/heartcraft';

export interface InstallOptions {
  slug: string;
  /** Heart ファイルを書き出すベースディレクトリ。デフォルトは process.cwd()。 */
  baseDir?: string;
  /** サーバ API のベース URL。デフォルトは env HEARTCRAFT_API_URL or http://localhost */
  apiUrl?: string;
}

export interface InstallResult {
  heartPath: string;
  skillMdPath: string;
  description: string;
}

/** install サブコマンドの本体。副作用は file system のみ。 */
export async function runInstall(opts: InstallOptions): Promise<InstallResult> {
  const { user, name } = parseSlug(opts.slug);
  const baseDir = opts.baseDir ?? process.cwd();
  const apiUrl = (opts.apiUrl ?? process.env.HEARTCRAFT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

  const url = `${apiUrl}/api/hearts/${encodeURIComponent(user)}/${encodeURIComponent(name)}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot reach HeartCraftLab API at ${apiUrl} (${msg}). Set HEARTCRAFT_API_URL to override.`);
  }

  if (res.status === 404) {
    throw new Error(`Heart not found: ${user}/${name}`);
  }
  if (!res.ok) {
    throw new Error(`API error (${res.status}): ${await res.text()}`);
  }

  const body = await res.text();
  const description = extractDescription(body);

  const skillsDir = resolve(baseDir, SKILLS_SUBPATH);
  const heartPath = join(skillsDir, user, `${name}.md`);
  const skillMdPath = join(skillsDir, 'SKILL.md');

  await mkdir(dirname(heartPath), { recursive: true });
  await writeFile(heartPath, body, 'utf8');
  await writeFile(skillMdPath, renderSkillMd({ user, name }), 'utf8');

  // telemetry: fire-and-forget。recordInstall は内部で例外を握りつぶす設計だが、
  // readCliVersion などここでの例外も install 自体の成否に影響させない。
  try {
    const cliVersion = await readCliVersion();
    await recordInstall({
      slug: `${user}/${name}`,
      apiUrl,
      cliVersion,
    });
  } catch {
    // noop
  }

  return { heartPath, skillMdPath, description };
}

/** commander action 用の薄いラッパー */
export async function installCommand(slug: string): Promise<void> {
  const result = await runInstall({ slug });
  const descLabel = result.description !== '' ? `（${result.description}）` : '';
  console.log(`✓ ${slug} をインストールしました${descLabel}`);
  console.log(`  - ${result.heartPath}`);
  console.log(`  - ${result.skillMdPath}（アクティブ Heart を更新）`);
}
