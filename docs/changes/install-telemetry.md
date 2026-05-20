# Install Telemetry 送信機能

**ステータス**：未実装（要件整理のみ）
**サーバ側**：実装済 ✅（`/api/installs` エンドポイント）

---

## 目的

`heartcraft install` 成功時に `POST /api/installs` を叩き、サーバ側 KPI（**ユニークインストール回数**、リリースから1ヶ月で 300件目標）を計測できるようにする。

これが無いと「リリースしても勝敗が分からない」状態になる。

---

## 動作要件

### タイミング

`install` サブコマンドの**最後**（heart ファイル書き込み + SKILL.md 生成が完了した後）に発火する。

### 失敗時の方針：fire-and-forget

telemetry の送信失敗は **install 自体の失敗扱いにしない**。

| 状況 | 挙動 |
|---|---|
| ネットワーク失敗（fetch 例外） | silent。install は成功で終了 |
| 4xx / 5xx レスポンス | silent。install は成功で終了 |
| タイムアウト | silent。**短めの timeout を強制**（後述） |

ユーザー体験を絶対に壊さない。「サーバ落ちてるけど install は動く」を保証する。

### timeout

`AbortController` で **2 秒程度**の hard timeout を入れる。telemetry のために CLI が固まるのは最悪。

---

## サーバへの送信内容

| 項目 | 値 |
|---|---|
| URL | `${HEARTCRAFT_API_URL}/api/installs` |
| Method | `POST` |
| Content-Type | `application/json` |
| Body | 下記 JSON |

```json
{
  "heart_id": "tanaka/zundamon",
  "machine_hash": "<sha256 hex 64>",
  "cli_version": "0.1.0",
  "os": "darwin"
}
```

### フィールド詳細

| フィールド | 必須 | 値 | 備考 |
|---|---|---|---|
| `heart_id` | ✅ | `<user>/<name>` slug 文字列 | サーバ側で resolve（数値 ID ではない。spec §6.5 の命名そのまま） |
| `machine_hash` | ✅ | hex 64 文字（lowercase） | `sha256(machineId + "<user>/<name>")` |
| `cli_version` | ✅ | semver 文字列 | `package.json` の `version` |
| `os` | ✅ | `darwin` / `linux` / `win32` | `process.platform` をそのまま（サーバ enum と一致） |

`ip_address` は**送らない**（サーバ側で `$request->ip()` から記録）。

### サーバ側バリデーション要件（参考）

- `heart_id`：regex `^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$`
- `machine_hash`：regex `^[a-f0-9]{64}$`
- `cli_version`：max 32 文字
- `os`：`in:darwin,linux,win32`

CLI 側でも同じ事前検証をかけ、不正値は送信しない（サーバを 422 で困らせない）。

---

## machine_hash 生成方針

### 入力

`sha256(machineId + "<user>/<name>")` — spec §6.5 の表記に従う。

`heart_id`（slug 値）を hash 入力に混ぜることで、**同一マシン + 同一 Heart のみ** が一致する。
別マシンや別 Heart は別 hash になる → サーバ側集計バッチで `COUNT(DISTINCT machine_hash) per heart_id` で uniq 算出。

### machineId の取得手段

**第一候補**：[`node-machine-id`](https://www.npmjs.com/package/node-machine-id)

```json
{
  "dependencies": {
    "node-machine-id": "^1.1.12"
  }
}
```

| プラットフォーム | machineId の取得元 |
|---|---|
| macOS | `ioreg` |
| Linux | `/etc/machine-id` or `/var/lib/dbus/machine-id` |
| Windows | レジストリ `HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography\\MachineGuid` |

依存追加コストは小さい（pure JS、依存ゼロ）。

**フォールバック**：何らかの理由で取得失敗した場合は telemetry を諦める（送信スキップ）。
※ ランダム値で代用しない → uniq 算出が壊れる。

### プライバシー配慮

- machineId 自体はサーバに送らない（sha256 でハッシュ化）
- ハッシュは Heart ごとに異なる（`heart_id` を mix）→ 横断的なマシン追跡を不可能にする
- 取得失敗時はスキップ → ユーザー環境を強制しない

---

## 実装範囲

### 新規ファイル

| ファイル | 内容 |
|---|---|
| `src/lib/telemetry.ts` | pure 関数 `recordInstall({ slug, apiUrl, cliVersion, timeoutMs })` |
| `tests/telemetry.test.ts` | vitest：payload shape / timeout / failure tolerance |

### 編集

| ファイル | 変更 |
|---|---|
| `src/commands/install.ts` | `runInstall` の最後で `recordInstall()` を呼ぶ。await はするが try/catch で握りつぶす |
| `src/lib/slug.ts` | `parseSlug` 結果から hash 用の `<user>/<name>` 文字列を組み立てるヘルパー（既存で十分なら不要） |
| `package.json` | `node-machine-id` 追加、`version` を CLI 内から `import pkg from '../package.json'` で参照 |
| `docs/spec.md` | §2 install フローに「7. telemetry 送信（best-effort）」追記 / §9 既知の制限の telemetry 行を「実装済」に更新 |
| `docs/roadmap.md` | telemetry 行のステータス更新 |

### 削除（実装 PR マージ後）

- `docs/changes/install-telemetry.md`（本ファイル）

---

## API 設計の関数シグネチャ案

```ts
// src/lib/telemetry.ts
export interface RecordInstallOptions {
  slug: string;           // "tanaka/zundamon"
  apiUrl: string;         // baseURL（trailing slash 除去済）
  cliVersion: string;     // package.json version
  timeoutMs?: number;     // default 2000
}

/**
 * install 成功時の telemetry 送信。
 * 副作用は fetch のみ。失敗は throw せず boolean で返す（呼び出し側で無視可能）。
 */
export async function recordInstall(opts: RecordInstallOptions): Promise<boolean>;
```

呼び出し側（install.ts）：

```ts
// runInstall の最後
try {
  await recordInstall({
    slug: `${user}/${name}`,
    apiUrl,
    cliVersion: PKG_VERSION,
  });
} catch {
  // 念のため二重 catch（recordInstall 内で吸ってるはずだが保険）
}
```

---

## テスト要件

`tests/telemetry.test.ts`：

- ✅ 正しい payload で fetch が呼ばれる（URL / method / headers / body）
- ✅ `machine_hash` が hex 64 文字
- ✅ 同じ slug + 同じマシンで 2 回呼ぶと同じ hash になる
- ✅ 違う slug だと違う hash になる
- ✅ fetch 失敗時に throw せず `false` を返す
- ✅ 2 秒で timeout する

`tests/install.test.ts`（追記）：

- ✅ telemetry が呼ばれる（spy）
- ✅ telemetry が失敗しても install が成功で返る
- ✅ telemetry のためにサーバ正常レスポンスが追加で必要にならない（既存テストが壊れない）

---

## 受け入れ条件

- [ ] `npx heartcraft install <user>/<name>` の成功表示は今と変わらない（telemetry の成否は出力しない）
- [ ] サーバ側 `heart_installs` テーブルに行が 1 行追加される
- [ ] サーバを停止して `install` を実行しても install 自体は成功で終わる（2 秒以内に）
- [ ] 同一マシンで同じ Heart を 2 回 install すると、同じ `machine_hash` の行が 2 行記録される（uniq 判定は集計バッチ Phase E4 側）
- [ ] vitest グリーン

---

## オープン事項

1. **`--no-telemetry` フラグ** を入れるか？ → MVP では入れない。将来 opt-out が欲しくなったら追加。
2. **`--verbose` 時の debug 表示** → MVP では入れない。telemetry はサイレント前提。
3. **`HEARTCRAFT_API_URL` 未設定時のデフォルト** → `http://localhost`（install と同じ）。本番リリース時に `https://heartcraftlab.com` に変える PR をセットで作る。

---

## 補足：実装時の落とし穴

事前に潰しておきたい小さな罠を列挙する。

### 1. `package.json` の version 取得

`tsconfig.json` の `"rootDir": "src"` のため `import pkg from '../package.json'` は TypeScript が拒否する。
**実行時読み込み**を採用する：

```ts
// src/lib/version.ts
import { readFile } from 'node:fs/promises';

export async function readCliVersion(): Promise<string> {
  const url = new URL('../../package.json', import.meta.url);
  const json = JSON.parse(await readFile(url, 'utf8')) as { version: string };
  return json.version;
}
```

ビルド後の `dist/lib/version.js` から見ると `../../package.json` が `dist/` の親（リポジトリルート）に当たる。
※ `dist/` の階層構造が変わったら URL も調整する。

### 2. `process.platform` の値域

Node の `process.platform` は spec で許可される `darwin / linux / win32` 以外にも `freebsd`、`openbsd`、`sunos`、`aix` を返し得る。
**サーバ側は `in:darwin,linux,win32` の enum で 422 を返す**ので、CLI 側で事前ガード：

```ts
const SUPPORTED_OS = ['darwin', 'linux', 'win32'] as const;
if (!SUPPORTED_OS.includes(process.platform as never)) {
  return false; // telemetry スキップ。install 自体は成功扱い
}
```

ランダム代用や `linux` フォールバックはしない（KPI が歪む）。

### 3. `node-machine-id` の ESM 互換

`node-machine-id` は CommonJS 配布。`"module": "nodenext"` 環境下では default import の解決でハマることがある。
動かなければ `createRequire` フォールバック：

```ts
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { machineId } = require('node-machine-id') as { machineId: (original?: boolean) => Promise<string> };
```

`@types/node-machine-id` は存在しないので、上記のような最小型注釈を入れる。

### 4. ローカル E2E 確認レシピ

実装後の自己確認手順：

```sh
# 1. サーバ起動（heart_installs を空にして確認したい場合は DB を初期化しておく）

# 2. CLI ビルド
npm run build

# 3. 別ディレクトリで install を実行
cd $(mktemp -d)
HEARTCRAFT_API_URL=http://localhost node /path/to/heartcraft/dist/cli.js install hatarson/zundamon

# 4. サーバ側で heart_installs に行が追加されたか確認

# 5. fire-and-forget の検証：サーバを止めて install が成功するか
# → fetch (download) も失敗するので install 全体は失敗するのが正しい
# → 「サーバ download 成功 + telemetry のみ失敗」の検証は、
#    HEARTCRAFT_API_URL を別ホストに分ける形で組むか、download 成功後に通信を意図的に切る手動テストでカバー
```
