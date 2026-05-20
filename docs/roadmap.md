# heartcraft 開発ロードマップ

本ドキュメントは CLI 側の開発計画を整理する。

---

## 現在のバージョン

**v0.1.0（pre-alpha）** — `install` サブコマンド（v0.2 で `use` にリネーム予定） + install telemetry 送信。

検証済の事実：
- ✅ API → frontmatter Markdown 取得
- ✅ `.claude/skills/heartcraft/<user>/<name>.md` への配置
- ✅ `SKILL.md` 生成によるアクティブ化
- ✅ 新規 Claude Code セッションで人格が適用される
- ✅ install 成功時に `POST /api/installs` を fire-and-forget で送信（KPI 計測）

---

## 次の作業（v0.2.0 想定）

| タスク | 内容 | 参照 |
|---|---|---|
| `install` → `use` リネーム | コマンド名・関数名・テスト名を更新。旧 `install` は撤去（pre-alpha なので後方互換維持しない） | spec.md §2 |
| `use` の DL スキップ分岐 | `.claude/skills/heartcraft/<user>/<name>.md` 存在チェック → 既にあれば DL を skip し SKILL.md 書き換えのみ | spec.md §2 |
| `clear` 実装 | SKILL.md の本文を「現在アクティブな Heart はありません。」に差し替え | spec.md §2 |
| API バージョンチェック | レスポンスヘッダ `X-Heartcraft-Api-Version` を確認し、サポート外なら警告 | spec.md §5 |

### MVP 対象外（Phase 2 以降）

| タスク | 内容 |
|---|---|
| `list` | `.claude/skills/heartcraft/` のディレクトリスキャン + アクティブ表示 |
| `search` | サーバ `GET /api/hearts/search?q=...` を叩く（要サーバ側実装） |

---

## v1.0.0 までに追加したい（安全性）

| 項目 | 動機 |
|---|---|
| atomic write（tempfile + rename） | SKILL.md 書き換え中断時の破損防止 |
| dry-run モード | ユーザーが実行前に副作用を確認できる |
| バックアップ作成 | 既存 SKILL.md を `.bak` に退避 |
| diff 表示 | アクティブ切り替え時に変更内容を可視化 |

---

## v1.0 リリース時に必要な周辺作業

- npm パッケージ公開（`npm publish --tag alpha` → 様子見後 `latest` 昇格）
- GitHub リリースタグ
- README の正式版（インストール手順 / トラブルシュート）
- サーバ API URL を本番（`https://heartcraftlab.com`）に切り替え
