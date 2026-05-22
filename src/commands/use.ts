import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { detectAgents, findCachedHeart, type AgentAdapter } from '../lib/agents.js';
import { green } from '../lib/color.js';
import { writeFileEnsureDir } from '../lib/fs.js';
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
   * frontmatter から取り出したキャラクター表示名（heart_prompts.name 相当、例: ずんだもん）。
   * DL でもキャッシュ再利用でも heartBody から抽出する。frontmatter に name が無い場合は空文字。
   */
  name: string | null;
  /** frontmatter から取り出した description。DL でもキャッシュ再利用でも heartBody から抽出する。 */
  description: string | null;
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

  if (cachedPath !== null) {
    heartBody = await readFile(cachedPath, 'utf8');
  } else {
    heartBody = await fetchHeart(apiUrl, slug.user, slug.name);
    downloaded = true;
  }

  // name/description は DL でもキャッシュ再利用でも heartBody から取り出す。
  const name = extractName(heartBody);
  const description = extractDescription(heartBody);

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

/**
 * use の成功表示を組み立てる pure 関数。
 * - headline: 1 行目に出す成功メッセージ（色なし）
 * - paths: 2 行目以降に出す Heart 本体ファイルの相対パス（agent ごとに 1 件）
 */
export function formatUseResult(
  result: UseResult,
  slug: string,
  cwd: string,
): { headline: string; paths: string[] } {
  // frontmatter に name (キャラクター表示名) があれば「<表示名> (<slug>)」、なければ「<slug>」のみ。
  const label =
    result.name !== null && result.name !== '' ? `${result.name} (${slug})` : slug;
  const verb = result.downloaded ? 'installed successfully!' : 'switched!';
  return {
    headline: `${label} ${verb}`,
    paths: result.agents.map((a) => relative(cwd, a.heartPath)),
  };
}

/** commander action 用の薄いラッパー */
export async function useCommand(slug: string): Promise<void> {
  const result = await runUse({ slug });
  const { headline, paths } = formatUseResult(result, slug, process.cwd());

  // 1 行目: 緑色で成功メッセージ
  console.log(green(headline));
  // 2 行目以降: Heart 本体ファイルの配置先（相対パス）
  for (const path of paths) {
    console.log(path);
  }
}
