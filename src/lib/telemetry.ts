import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

// node-machine-id は CJS 配布。ESM (`"module": "nodenext"`) からの named import が
// 一部 Node 実行環境（tsx 等）で resolve に失敗するため createRequire 経由で読む。
const require = createRequire(import.meta.url);
const { machineId } = require('node-machine-id') as {
  machineId: (original?: boolean) => Promise<string>;
};

const HEART_ID_PATTERN = /^[a-z0-9][a-z0-9_-]*\/[a-z0-9][a-z0-9_-]*$/;
const SUPPORTED_OS = new Set(['darwin', 'linux', 'win32']);
const DEFAULT_TIMEOUT_MS = 2000;
const CLI_VERSION_MAX_LEN = 32;

export interface RecordInstallOptions {
  slug: string;
  apiUrl: string;
  cliVersion: string;
  timeoutMs?: number;
  /** テスト用 DI。未指定なら node-machine-id の machineId を使う */
  machineIdFn?: () => Promise<string>;
}

/** machineId と slug を結合して sha256 hex を返す。pure 関数。 */
export function computeMachineHash(machineIdValue: string, slug: string): string {
  return createHash('sha256').update(machineIdValue + slug).digest('hex');
}

/**
 * install 成功時の telemetry 送信。fire-and-forget 前提で、失敗時も throw せず boolean を返す。
 *
 * - サーバ側バリデーション (heart_id / machine_hash / cli_version / os) と同等の事前チェックを通す。
 *   通らない場合は送信スキップで false。
 * - machineId 取得失敗時もスキップ（ランダム値で代用しない → KPI 集計が壊れるため）。
 * - fetch のタイムアウトは AbortController で hard timeout (default 2s)。
 */
export async function recordInstall(opts: RecordInstallOptions): Promise<boolean> {
  const os = process.platform;
  if (!SUPPORTED_OS.has(os)) {
    return false;
  }
  if (!HEART_ID_PATTERN.test(opts.slug)) {
    return false;
  }
  if (opts.cliVersion.length === 0 || opts.cliVersion.length > CLI_VERSION_MAX_LEN) {
    return false;
  }

  const getMachineId = opts.machineIdFn ?? machineId;
  let mid: string;
  try {
    mid = await getMachineId();
  } catch {
    return false;
  }
  if (mid === '') {
    return false;
  }

  const hash = computeMachineHash(mid, opts.slug);
  const apiUrl = opts.apiUrl.replace(/\/$/, '');
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${apiUrl}/api/installs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        heart_id: opts.slug,
        machine_hash: hash,
        cli_version: opts.cliVersion,
        os,
      }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
