import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  renderCopilotInstructions,
  renderCursorRule,
  renderGeminiManifest,
  renderGeminiMd,
  renderSkillMd,
} from './skill.js';
import type { HeartSlug } from './slug.js';

export interface ActivationFile {
  path: string;
  content: string;
}

/**
 * 1 つの AI エージェントに対する Heart 配置戦略。
 * - detect: cwd に該当エージェントの痕跡（marker file/dir）があるか
 * - heartPath: Heart 本体 Markdown を書き出すパス
 * - renderActivation: アクティブ参照を書き換えるための活性化ファイル群（複数可）
 */
export interface AgentAdapter {
  /** 内部識別子（'claude-code' / 'cursor' / 'copilot' / 'gemini-cli'） */
  name: string;
  /** 表示用名称（ログ出力） */
  displayName: string;
  /** baseDir 直下に該当エージェントの marker があるかを返す */
  detect(baseDir: string): Promise<boolean>;
  /** Heart 本体 Markdown を書き出す絶対パス */
  heartPath(baseDir: string, slug: HeartSlug): string;
  /**
   * 活性化ファイル群（パス + 内容）。
   * @param heartBody Heart 本体 Markdown（インライン埋め込みする agent 用）。Claude Code は同ディレクトリ参照で済むため使わない。
   */
  renderActivation(baseDir: string, slug: HeartSlug | null, heartBody: string | null): ActivationFile[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** いずれかのパスが存在すれば true */
async function anyExists(baseDir: string, candidates: string[]): Promise<boolean> {
  for (const rel of candidates) {
    if (await pathExists(resolve(baseDir, rel))) {
      return true;
    }
  }
  return false;
}

// ---------- Claude Code ----------

const CLAUDE_SKILLS_DIR = '.claude/skills/heartcraft';

export const claudeCodeAdapter: AgentAdapter = {
  name: 'claude-code',
  displayName: 'Claude Code',
  async detect(baseDir) {
    return anyExists(baseDir, ['CLAUDE.md', '.claude']);
  },
  heartPath(baseDir, slug) {
    return resolve(baseDir, CLAUDE_SKILLS_DIR, slug.user, `${slug.name}.md`);
  },
  renderActivation(baseDir, slug) {
    return [
      {
        path: resolve(baseDir, CLAUDE_SKILLS_DIR, 'SKILL.md'),
        content: renderSkillMd(slug),
      },
    ];
  },
};

// ---------- Cursor ----------

const CURSOR_RULES_DIR = '.cursor/rules/heartcraft';
const CURSOR_MDC_PATH = '.cursor/rules/heartcraft.mdc';

export const cursorAdapter: AgentAdapter = {
  name: 'cursor',
  displayName: 'Cursor',
  async detect(baseDir) {
    return anyExists(baseDir, ['.cursor', '.cursorrules']);
  },
  heartPath(baseDir, slug) {
    return resolve(baseDir, CURSOR_RULES_DIR, slug.user, `${slug.name}.md`);
  },
  renderActivation(baseDir, slug, heartBody) {
    return [
      {
        path: resolve(baseDir, CURSOR_MDC_PATH),
        content: renderCursorRule(slug, heartBody),
      },
    ];
  },
};

// ---------- GitHub Copilot ----------

const COPILOT_INSTRUCTIONS_DIR = '.github/instructions/heartcraft';
const COPILOT_INSTRUCTIONS_PATH = '.github/instructions/heartcraft.instructions.md';

export const copilotAdapter: AgentAdapter = {
  name: 'copilot',
  displayName: 'GitHub Copilot',
  async detect(baseDir) {
    return anyExists(baseDir, [
      '.github/copilot-instructions.md',
      '.github/instructions',
    ]);
  },
  heartPath(baseDir, slug) {
    return resolve(baseDir, COPILOT_INSTRUCTIONS_DIR, slug.user, `${slug.name}.md`);
  },
  renderActivation(baseDir, slug, heartBody) {
    return [
      {
        path: resolve(baseDir, COPILOT_INSTRUCTIONS_PATH),
        content: renderCopilotInstructions(slug, heartBody),
      },
    ];
  },
};

// ---------- Gemini CLI ----------

const GEMINI_EXTENSION_DIR = '.gemini/extensions/heartcraft';
const GEMINI_HEARTS_DIR = `${GEMINI_EXTENSION_DIR}/hearts`;
const GEMINI_MANIFEST_PATH = `${GEMINI_EXTENSION_DIR}/gemini-extension.json`;
const GEMINI_CONTEXT_PATH = `${GEMINI_EXTENSION_DIR}/GEMINI.md`;
// extension マニフェストに書く version。CLI 本体の version とは独立に bump する。
const GEMINI_EXTENSION_VERSION = '0.1.0';

export const geminiCliAdapter: AgentAdapter = {
  name: 'gemini-cli',
  displayName: 'Gemini CLI',
  async detect(baseDir) {
    return anyExists(baseDir, ['GEMINI.md', '.gemini']);
  },
  heartPath(baseDir, slug) {
    return resolve(baseDir, GEMINI_HEARTS_DIR, slug.user, `${slug.name}.md`);
  },
  renderActivation(baseDir, slug, heartBody) {
    return [
      {
        path: resolve(baseDir, GEMINI_MANIFEST_PATH),
        content: renderGeminiManifest(GEMINI_EXTENSION_VERSION),
      },
      {
        path: resolve(baseDir, GEMINI_CONTEXT_PATH),
        content: renderGeminiMd(slug, heartBody),
      },
    ];
  },
};

// ---------- public api ----------

export const ALL_ADAPTERS: readonly AgentAdapter[] = [
  claudeCodeAdapter,
  cursorAdapter,
  copilotAdapter,
  geminiCliAdapter,
];

/**
 * baseDir で検知された AgentAdapter のリストを返す。
 * 1 つも検知されなかった場合は Claude Code のみを返す（フォールバック）。
 */
export async function detectAgents(baseDir: string, adapters: readonly AgentAdapter[] = ALL_ADAPTERS): Promise<AgentAdapter[]> {
  const detected: AgentAdapter[] = [];
  for (const adapter of adapters) {
    if (await adapter.detect(baseDir)) {
      detected.push(adapter);
    }
  }
  if (detected.length === 0) {
    return [claudeCodeAdapter];
  }
  return detected;
}

/** baseDir に既に Heart ファイルがあるか（いずれかの agent パスで）。あれば最初の 1 件のパスを返す。 */
export async function findCachedHeart(
  baseDir: string,
  slug: HeartSlug,
  adapters: readonly AgentAdapter[],
): Promise<string | null> {
  for (const adapter of adapters) {
    const path = adapter.heartPath(baseDir, slug);
    if (await pathExists(path)) {
      return path;
    }
  }
  return null;
}

