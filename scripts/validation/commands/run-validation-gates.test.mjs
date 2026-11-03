import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PRE_PUSH_STDIN_ENV, readPushHookInput } from './run-validation-gates.mjs';

describe('push hook input', () => {
  it('ignores a never-ending stdin unless the pre-push wrapper opted in', async () => {
    const stdin = new PassThrough();
    stdin.write('refs/heads/main abc refs/heads/main def\n');
    await expect(readPushHookInput({ stdin, env: {} })).resolves.toBe('');
    stdin.destroy();
  });

  it('reads git ref lines when invoked by the pre-push wrapper', async () => {
    const stdin = new PassThrough();
    const input = readPushHookInput({ stdin, env: { [PRE_PUSH_STDIN_ENV]: '1' } });
    stdin.end('refs/heads/main abc refs/heads/main def\n');
    await expect(input).resolves.toBe('refs/heads/main abc refs/heads/main def\n');
  });

  it('never blocks on an interactive terminal', async () => {
    const stdin = Object.assign(new PassThrough(), { isTTY: true });
    await expect(readPushHookInput({ stdin, env: { [PRE_PUSH_STDIN_ENV]: '1' } })).resolves.toBe(
      '',
    );
    stdin.destroy();
  });
});
