# heartcraft

[HeartCraftLab](https://heartcraftlab.com) で配信される AI 人格プロンプト（Heart）を、
Claude Code に1コマンドで導入する CLI です。

```sh
npx heartcraft use tanaka/zundamon
```

## ステータス

開発初期段階（pre-alpha）。MVP リリースに向けて構築中。

## 使い方

基本は `use` 1コマンドだけ覚えればOK。インストールも切り替えも同じ：未取得ならサーバから取得、取得済みなら切り替えのみ。

| コマンド | 動作 |
|---|---|
| `npx heartcraft use <user>/<name>` | アクティブハートを `<user>/<name>` にする（必要なら取得 → 配置 → アクティブ化） |
| `npx heartcraft clear` | アクティブハートを解除（配置済みファイルは残す） |

### MVP 対象外（Phase 2 以降）

| コマンド | 動作 |
|---|---|
| `npx heartcraft list` | インストール済み Heart 一覧 |
| `npx heartcraft search <keyword>` | Heart を検索 |

## サーバ API 互換性

| CLI バージョン | サーバ API バージョン |
|---|---|
| 0.0.x | v1 |

## 開発

```sh
npm install
npm run dev -- use testuser/example       # ts ファイルを直接実行
npm run build                              # dist/ に出力
npm test                                   # vitest 実行
```
