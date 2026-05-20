import type { HeartSlug } from './slug.js';

const SKILL_DESCRIPTION =
  'HeartCraftLab で配信される人格（Heart）を常時適用するエントリポイント。' +
  'あらゆる会話・あらゆる質問・あらゆるタスクに対して、必ずこのスキルを読み込み、' +
  '参照先 Heart の指示に従って応答すること。';

const INACTIVE_MESSAGE = '現在アクティブな Heart はありません。';

/** Claude Code: SKILL.md（同ディレクトリの Heart ファイルを参照する） */
export function renderSkillMd(active: HeartSlug | null): string {
  const body = active === null
    ? INACTIVE_MESSAGE
    : `このスキルが読み込まれたら、必ず同ディレクトリの **${active.user}/${active.name}.md** を読み込み、そこに書かれた人格指示を会話全体に適用する。`;

  return `---
name: heartcraft
description: ${SKILL_DESCRIPTION}
---

# HeartCraftLab Heart Loader

${body}
`;
}

/** Cursor: MDC ルール。`alwaysApply: true` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCursorRule(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `---
description: ${SKILL_DESCRIPTION}
alwaysApply: true
---

# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `---
description: ${SKILL_DESCRIPTION}
alwaysApply: true
---

# HeartCraftLab Heart Loader (${active.user}/${active.name})

以下の人格指示を会話全体に常時適用すること。

${stripFrontmatter(heartBody)}
`;
}

/** Copilot: `*.instructions.md`。`applyTo: '**'` で常時適用。Heart 本体をインラインで埋め込む。 */
export function renderCopilotInstructions(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `---
description: ${SKILL_DESCRIPTION}
applyTo: '**'
---

# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `---
description: ${SKILL_DESCRIPTION}
applyTo: '**'
---

# HeartCraftLab Heart Loader (${active.user}/${active.name})

以下の人格指示を会話全体に常時適用すること。

${stripFrontmatter(heartBody)}
`;
}

/** Gemini CLI: extension の GEMINI.md。Heart 本体をインラインで埋め込む。 */
export function renderGeminiMd(active: HeartSlug | null, heartBody: string | null): string {
  if (active === null || heartBody === null) {
    return `# HeartCraftLab Heart Loader

${INACTIVE_MESSAGE}
`;
  }

  return `# HeartCraftLab Heart Loader (${active.user}/${active.name})

以下の人格指示を会話全体に常時適用すること。

${stripFrontmatter(heartBody)}
`;
}

/** Gemini CLI: extension マニフェスト（最小構成） */
export function renderGeminiManifest(version: string): string {
  const manifest = {
    name: 'heartcraft',
    version,
    contextFileName: 'GEMINI.md',
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** frontmatter 付き Markdown から description 行を取り出す。なければ空文字。 */
export function extractDescription(content: string): string {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm === null) {
    return '';
  }
  const desc = fm[1].match(/^description:\s*(.+)$/m);
  if (desc === null) {
    return '';
  }
  return desc[1].trim().replace(/^['"]|['"]$/g, '');
}

/** frontmatter ブロックを取り除いて本文だけ返す。frontmatter が無ければそのまま返す。 */
function stripFrontmatter(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?/);
  if (m === null) {
    return content.trim();
  }
  return content.slice(m[0].length).trim();
}
