import type { HeartSlug } from './slug.js';

const SKILL_DESCRIPTION =
  'HeartCraftLab で配信される人格（Heart）を Claude Code に常時適用するエントリポイント。' +
  'あらゆる会話・あらゆる質問・あらゆるタスクに対して、必ずこのスキルを読み込み、' +
  '参照先 Heart の指示に従って応答すること。';

/** SKILL.md の中身を、与えられたアクティブ Heart で生成して返す。 */
export function renderSkillMd(active: HeartSlug | null): string {
  const body = active === null
    ? '現在アクティブな Heart はありません。'
    : `このスキルが読み込まれたら、必ず同ディレクトリの **${active.user}/${active.name}.md** を読み込み、そこに書かれた人格指示を会話全体に適用する。`;

  return `---
name: heartcraft
description: ${SKILL_DESCRIPTION}
---

# HeartCraftLab Heart Loader

${body}
`;
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
