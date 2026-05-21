import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { detectAgents, findCachedHeart, type AgentAdapter } from '../lib/agents.js';
import { parseSlug } from '../lib/slug.js';
import { extractDescription, extractName } from '../lib/skill.js';
import { recordInstall } from '../lib/telemetry.js';
import { readCliVersion } from '../lib/version.js';

const DEFAULT_API_URL = 'https://heartcraftlab.com';

export interface UseOptions {
  slug: string;
  /** Heart ファイルを書き出すベースディレクトリ。デフォルトは process.cwd()。 */
  baseDir?: string;
  /** サーバ API のベース URL。デフォルトは env HEARTCRAFT_API_URL or https://heartcraftlab.com */
  apiUrl?: string;
  /** テスト DI: 検知済 agent を直接渡す。指定したら detectAgents をスキップする。 */
  agents?: readonly AgentAdapter[];
}

export interface UseAgentResult {
  agent: string;
  displayName: string;
  heartPath: string;
  activationPaths: string[];
}

export interface UseResult {
  /** 適用された agent 群 */
  agents: UseAgentResult[];
  /** サーバから DL が走ったかどうか。 */
  downloaded: boolean;
  /**
   * DL したときは frontmatter から取り出したキャラクター表示名（heart_prompts.name 相当、例: ずんだもん）。
   * frontmatter に name が無い場合は空文字。DL スキップ時は null。
   */
  name: string | null;
  /** DL したときは frontmatter から取り出した description。DL スキップ時は null。 */
  description: string | null;
}

async function writeFileEnsureDir(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

async function fetchHeart(apiUrl: string, user: string, name: string): Promise<string> {
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

  return res.text();
}

/** use サブコマンドの本体。副作用は file system + fetch のみ。 */
export async function runUse(opts: UseOptions): Promise<UseResult> {
  const slug = parseSlug(opts.slug);
  const baseDir = opts.baseDir ?? process.cwd();
  const apiUrl = (opts.apiUrl ?? process.env.HEARTCRAFT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

  const agents = opts.agents ?? (await detectAgents(baseDir));

  // どの agent でも未取得の場合のみ DL する。1 つでもキャッシュがあれば再利用。
  const cachedPath = await findCachedHeart(baseDir, slug, agents);
  let heartBody: string;
  let downloaded = false;
  let name: string | null = null;
  let description: string | null = null;

  if (cachedPath !== null) {
    heartBody = await readFile(cachedPath, 'utf8');
  } else {
    heartBody = await fetchHeart(apiUrl, slug.user, slug.name);
    downloaded = true;
    name = extractName(heartBody);
    description = extractDescription(heartBody);
  }

  // 各 agent に Heart ファイル本体 + activation ファイル群を書き出す
  const results: UseAgentResult[] = [];
  for (const agent of agents) {
    const heartPath = agent.heartPath(baseDir, slug);
    await writeFileEnsureDir(heartPath, heartBody);

    const activation = agent.renderActivation(baseDir, slug, heartBody);
    for (const file of activation) {
      await writeFileEnsureDir(file.path, file.content);
    }

    results.push({
      agent: agent.name,
      displayName: agent.displayName,
      heartPath,
      activationPaths: activation.map((f) => f.path),
    });
  }

  // telemetry: DL が走った時のみ fire-and-forget で送信
  if (downloaded) {
    try {
      const cliVersion = await readCliVersion();
      await recordInstall({
        slug: `${slug.user}/${slug.name}`,
        apiUrl,
        cliVersion,
      });
    } catch {
      // noop
    }
  }

  return { agents: results, downloaded, name, description };
}

/** commander action 用の薄いラッパー */
export async function useCommand(slug: string): Promise<void> {
  const result = await runUse({ slug });

  const verb = result.downloaded ? 'インストールしました' : '切り替えました';
  // DL 時のみ表示名を出す。frontmatter に name (キャラクター表示名) があれば「<表示名> (<slug>)」、なければ「<slug>」のみ。
  const headline =
    result.downloaded && result.name !== null && result.name !== ''
      ? `${result.name} (${slug})`
      : slug;
  const descLabel = result.downloaded && result.description !== null && result.description !== ''
    ? `（${result.description}）`
    : '';
  console.log(`✓ ${headline} を ${result.agents.map((a) => a.displayName).join(' / ')} に${verb}${descLabel}`);

  for (const a of result.agents) {
    console.log(`  [${a.displayName}]`);
    console.log(`    - ${a.heartPath}`);
    for (const ap of a.activationPaths) {
      console.log(`    - ${ap}（アクティブ Heart を更新）`);
    }
  }
}
