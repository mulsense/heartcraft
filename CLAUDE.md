# heartcraft (CLI)

## プロダクト概要

[HeartCraftLab](https://heartcraftlab.com) で配信される AI 人格プロンプト（Heart）を
Claude Code に1コマンドで導入する CLI。

```sh
npx heartcraft install hatarson/zundamon
```

サーバから frontmatter 付き Markdown を取得し、`.claude/skills/heartcraft/<user>/<name>.md`
に保存、`SKILL.md` のアクティブ Heart 参照を書き換えて即適用する。

## 兄弟リポジトリ（HeartCraftLab）

このCLIは [HeartCraftLab](../HeartCraftLab/) の API クライアントです。
両リポは **`../` で sibling 配置**することを前提にしています。

| 取得元 | 場所 |
|---|---|
| API 契約（URL / レスポンス形式 / frontmatter） | [../HeartCraftLab/docs/spec.md](../HeartCraftLab/docs/spec.md) §5.3（source of truth） |
| DB スキーマ・人格データの実体 | [../HeartCraftLab/.claude/rules/database.md](../HeartCraftLab/.claude/rules/database.md) |
| CLI 仕様（サブコマンド・ファイル配置・SKILL.md 形式） | [docs/spec.md](docs/spec.md)（本リポが source of truth） |
| 起業フェーズ・KPI・マーケ計画 | ../HeartCraftLab 側のみ |

クロスリポ変更（API 契約の追加 / 変更）は両リポに同期 PR を立てる。

## 技術スタック

- **TypeScript**（strict、ESM）
- **commander** — CLI 引数パーサ
- **fetch**（Node 18+ 組み込み）
- **vitest** — テスト
- **tsc** — ビルド（バンドラなし、shebang 付き JS を `dist/` に出力）

依存追加は最小主義。バンドラ・ランタイム重い依存は避ける。

## 開発環境

- **Node 18 以上**（fetch 組み込みが必要）
- `npm install` で依存解決
- `npm run dev -- <subcommand> [args]` — TypeScript を直接実行（tsx）
- `npm run build` — `dist/` に出力
- `npm test` — vitest 実行（`vitest run`）
- `npm run test:watch` — watch モード

## ローカルでサーバと組み合わせて動かす

1. `../HeartCraftLab` 側で `sail up -d` + `sail artisan db:seed`
2. 本リポで `npm run build`
3. 任意の作業ディレクトリで実行：
   ```sh
   cd $(mktemp -d)
   node /Users/furihata/Documents/GitHub/heartcraft/dist/cli.js install hatarson/zundamon
   claude   # 新規 Claude Code セッション → 人格適用確認
   ```

`HEARTCRAFT_API_URL` 環境変数でサーバ URL を上書き可（デフォルト `http://localhost`）。

## ディレクトリ構成

```
src/
├── cli.ts              # commander エントリポイント（shebang 付き）
├── commands/           # サブコマンド実装（1ファイル1コマンド）
│   └── install.ts
└── lib/                # 共通ロジック（pure 関数中心）
    ├── slug.ts         # <user>/<name> の parse
    └── skill.ts        # SKILL.md レンダリング / frontmatter 抽出
tests/                  # vitest（src と対応）
dist/                   # tsc 出力（gitignore）
```

## コーディングルール

- **TypeScript strict**、`any` は原則禁止
- **副作用は引数で受ける**：`runInstall({ slug, baseDir, apiUrl })` のように fs / fetch / env への依存をパラメータ化 → テストで mock しやすい
- 薄い commander action はその pure 関数を呼ぶだけにする
- **コメントは日本語 OK**
- **コミットはユーザーの指示があってから**。勝手にしない

## テスト方針

- **slug / SKILL.md レンダリングなどの pure 関数**：直接ユニットテスト
- **install / switch などの I/O フロー**：`vi.spyOn(globalThis, 'fetch')` でモック + `mkdtemp` で一時ディレクトリ
- **CLI 起動のスモーク**：`execFileSync('npx', ['tsx', ...])` で `--version` `--help` 程度（ネットワークに依存させない）

## 重要なドキュメント

- [README.md](README.md) — エンドユーザー向け
- [docs/spec.md](docs/spec.md) — CLI 仕様（サブコマンド / ファイル配置 / SKILL.md / API 接続）
- [docs/roadmap.md](docs/roadmap.md) — 開発ロードマップ
- [../HeartCraftLab/docs/spec.md](../HeartCraftLab/docs/spec.md) — サーバ側仕様（API 契約の source of truth）
