# heartcraft

[HeartCraftLab](https://heartcraftlab.com) で配信される AI 人格プロンプト（Heart）を、
Claude Code に1コマンドで導入する CLI です。

```sh
npx heartcraft install tanaka/zundamon
```

## ステータス

開発初期段階（pre-alpha）。MVP リリースに向けて構築中。

## 使い方（実装予定）

| コマンド | 動作 |
|---|---|
| `npx heartcraft install <user>/<name>` | Heart を取得し `.claude/skills/heartcraft/` に配置 + アクティブ化 |
| `npx heartcraft switch <user>/<name>` | インストール済み Heart を切り替え |
| `npx heartcraft list` | インストール済み Heart 一覧 |
| `npx heartcraft uninstall <user>/<name>` | Heart を削除 |
| `npx heartcraft search <keyword>` | Heart を検索 |

## サーバ API 互換性

| CLI バージョン | サーバ API バージョン |
|---|---|
| 0.0.x | v1 |

## 開発

```sh
npm install
npm run dev -- install testuser/example   # ts ファイルを直接実行
npm run build                              # dist/ に出力
npm test                                   # vitest 実行
```
