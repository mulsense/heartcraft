# heartcraft 開発ロードマップ

サーバ側の全体スプリント計画は [../../HeartCraftLab/docs/sprints.md](../../HeartCraftLab/docs/sprints.md)。
本ドキュメントは CLI 側のみを抜き出して整理。

---

## 現在のバージョン

**v0.0.1（pre-alpha）** — `install` サブコマンドのみ実装、実機 E2E 検証済。

検証済の事実：
- ✅ API → frontmatter Markdown 取得
- ✅ `.claude/skills/heartcraft/<user>/<name>.md` への配置
- ✅ `SKILL.md` 生成によるアクティブ化
- ✅ 新規 Claude Code セッションで人格が適用される

---

## 次の作業（v0.1.0 想定）

サーバ側 [sprints.md](../../HeartCraftLab/docs/sprints.md) の **Phase E** に対応する CLI 側タスク群：

| タスク | 内容 | 参照 |
|---|---|---|
| `switch` 実装 | SKILL.md 参照行の書き換えのみ（DL なし） | spec.md §2 |
| `list` 実装 | `.claude/skills/heartcraft/` のディレクトリスキャン + アクティブ表示 | spec.md §2 |
| `uninstall` 実装 | ファイル削除 + 参照クリア | spec.md §2 |
| `search` 実装 | サーバ `GET /api/hearts/search?q=...` を叩く（要サーバ側実装） | サーバ spec §5.3 |
| telemetry 送信 | `POST /api/installs` を install 時に叩く | サーバ spec §5.3 |
| API バージョンチェック | レスポンスヘッダ `X-Heartcraft-Api-Version` を確認し、サポート外なら警告 | spec.md §5 |

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

サーバ側 sprints.md の **Phase F** と同期：

- npm パッケージ公開（`npm publish --tag alpha` → 様子見後 `latest` 昇格）
- GitHub リリースタグ
- README の正式版（インストール手順 / トラブルシュート）
- サーバ API URL を本番（`https://heartcraftlab.com`）に切り替え

---

## クロスリポ参照ルール

API 契約の変更（URL・レスポンス形式・frontmatter）は両リポに**同期 PR**を立てる：

- サーバ側 PR → API 変更
- CLI 側 PR → 対応する fetch / parse 変更
- 互いの PR 説明にリンクを張る

API 契約以外の変更（CLI 独自挙動・出力フォーマット等）は本リポ単独で進めて OK。
