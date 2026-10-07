import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';

import { listMatrixCases } from './bench-matrix-cases';

describe('matrix worker protocol', () => {
  it('uses its own WASM instance and reports one expected-invalid case exactly once', async () => {
    const item = listMatrixCases().find(
      (candidate) => candidate.id === 'articulated-name/contour/bungee/short',
    );
    expect(item).toBeDefined();
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/bench-matrix.ts'], {
      env: { ...process.env, MATRIX_WORKER: '1', MATRIX_WORKER_ID: 'test' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => output.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.stdin.end(`${JSON.stringify({ packageId: 0, cases: [item] })}\n`);
    const [status] = (await once(child, 'close')) as [number | null];
    const events = Buffer.concat(output)
      .toString()
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(status, Buffer.concat(errors).toString()).toBe(0);
    expect(events.filter((event) => event.type === 'case-completed')).toHaveLength(1);
    expect(events.find((event) => event.type === 'case-completed')).toMatchObject({
      id: item?.id,
      category: 'expectedInvalid',
    });
    expect(events.filter((event) => event.type === 'package-completed')).toHaveLength(1);
  }, 30000);
});
