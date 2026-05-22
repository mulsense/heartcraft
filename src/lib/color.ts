/** 色付け判定で参照するストリームの最小インターフェース。 */
interface ColorStream {
  isTTY?: boolean;
}

/**
 * ANSI カラーを付けてよいかを判定する。
 * TTY 出力かつ NO_COLOR 環境変数が未設定のときだけ true。
 * NO_COLOR は値に関わらず「存在」で無効化する。
 * @see https://no-color.org/
 */
export function colorEnabled(
  stream: ColorStream = process.stdout,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(stream.isTTY) && env.NO_COLOR === undefined;
}

/** テキストを緑色の ANSI シーケンスで包む。enabled=false ならそのまま返す。 */
export function green(text: string, enabled: boolean = colorEnabled()): string {
  return enabled ? `\x1b[32m${text}\x1b[0m` : text;
}
