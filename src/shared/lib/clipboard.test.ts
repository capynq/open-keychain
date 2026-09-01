import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard } from './clipboard';

describe('copyTextToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails closed when no browser document is available', async () => {
    await expect(copyTextToClipboard('design')).resolves.toBe(false);
  });

  it('falls back to the legacy copy command when Clipboard API rejects', async () => {
    const textarea = {
      setAttribute: vi.fn(),
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
      remove: vi.fn(),
    };
    const documentMock = {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => textarea),
      execCommand: vi.fn(() => true),
    };

    vi.stubGlobal('window', {});
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
    });

    await expect(copyTextToClipboard('design')).resolves.toBe(true);
    expect(documentMock.execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalledOnce();
  });
});
