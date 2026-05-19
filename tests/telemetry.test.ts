import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMachineHash, recordInstall } from '../src/lib/telemetry.js';

const FAKE_MACHINE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const fakeMachineIdFn = () => Promise.resolve(FAKE_MACHINE_ID);

describe('computeMachineHash', () => {
  it('returns 64 hex chars', () => {
    const h = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for same machine + slug', () => {
    const a = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon');
    const b = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon');
    expect(a).toBe(b);
  });

  it('differs for different slugs', () => {
    const a = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon');
    const b = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/metan');
    expect(a).not.toBe(b);
  });

  it('differs for different machineIds', () => {
    const a = computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon');
    const b = computeMachineHash('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'tanaka/zundamon');
    expect(a).not.toBe(b);
  });
});

describe('recordInstall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs the correct payload to /api/installs', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 201 }));

    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      machineIdFn: fakeMachineIdFn,
    });

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub/api/installs');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.heart_id).toBe('tanaka/zundamon');
    expect(body.cli_version).toBe('0.1.0');
    expect(body.os).toBe(process.platform);
    expect(body.machine_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.machine_hash).toBe(computeMachineHash(FAKE_MACHINE_ID, 'tanaka/zundamon'));
  });

  it('strips trailing slash from apiUrl', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 201 }));

    await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub/',
      cliVersion: '0.1.0',
      machineIdFn: fakeMachineIdFn,
    });

    expect((fetchSpy.mock.calls[0] as [string, RequestInit])[0]).toBe('http://stub/api/installs');
  });

  it('returns false on fetch failure (without throwing)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      machineIdFn: fakeMachineIdFn,
    });

    expect(ok).toBe(false);
  });

  it('returns false on 4xx/5xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('boom', { status: 422 }));

    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      machineIdFn: fakeMachineIdFn,
    });

    expect(ok).toBe(false);
  });

  it('times out via AbortController', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        const signal = (init as RequestInit).signal as AbortSignal;
        signal.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const start = Date.now();
    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      timeoutMs: 30,
      machineIdFn: fakeMachineIdFn,
    });
    const elapsed = Date.now() - start;

    expect(ok).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });

  it('returns false when slug fails server-side regex', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const ok = await recordInstall({
      slug: 'BAD/case',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      machineIdFn: fakeMachineIdFn,
    });

    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns false when cliVersion exceeds 32 chars', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: 'x'.repeat(33),
      machineIdFn: fakeMachineIdFn,
    });

    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns false when machineId fetch throws', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const ok = await recordInstall({
      slug: 'tanaka/zundamon',
      apiUrl: 'http://stub',
      cliVersion: '0.1.0',
      machineIdFn: () => Promise.reject(new Error('ioreg failed')),
    });

    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
