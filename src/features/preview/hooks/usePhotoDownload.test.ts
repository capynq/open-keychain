// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PhotoCaptureApi } from '../model/photo-capture';
import type { PhotoFormat } from '../model/photo-format';

import { usePhotoDownload, type PhotoDownloadState } from './usePhotoDownload';

describe('usePhotoDownload', () => {
  let root: Root;
  let host: HTMLDivElement;
  let download: (resolution: 1024 | 2048 | 4096, format?: PhotoFormat) => Promise<boolean>;
  let state: PhotoDownloadState;

  const Harness = ({
    captureApi,
    text = 'ALEX',
  }: {
    captureApi?: PhotoCaptureApi;
    text?: string;
  }) => {
    const result = usePhotoDownload({
      captureApi,
      design: { text, templateId: 'name-keychain', styleId: 'contour' },
    });
    download = result.download;
    state = result.state;
    return createElement('output', null, state.status);
  };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:photo'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('guards duplicate captures and starts the browser download', async () => {
    let resolveCapture: ((blob: Blob) => void) | undefined;
    const capture = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveCapture = resolve;
        }),
    );
    const captureApi = { maxTextureSize: 4096, capture };
    const append = vi.spyOn(document.body, 'append');

    act(() => root.render(createElement(Harness, { captureApi })));
    let first!: Promise<boolean>;
    await act(async () => {
      first = download(2048);
      await Promise.resolve();
    });
    expect(state).toEqual({ status: 'preparing', resolution: 2048, format: 'png' });
    await act(async () => {
      await download(1024);
    });
    expect(capture).toHaveBeenCalledOnce();
    // An accepted design update during capture must not rename the previous image.
    act(() => root.render(createElement(Harness, { captureApi, text: 'NEW NAME' })));

    await act(async () => {
      resolveCapture?.(new Blob(['photo'], { type: 'image/png' }));
      await first;
    });
    expect(state).toEqual({ status: 'success', resolution: 2048, format: 'png' });
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ download: 'alex-name-keychain-contour-2048px.png' }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledWith(2048, 'png');
  });

  it('downloads JPG with the selected format and filename', async () => {
    const captureApi = {
      maxTextureSize: 4096,
      capture: vi.fn(
        async (_resolution: number, format = 'png') =>
          new Blob(['photo'], { type: format === 'jpg' ? 'image/jpeg' : 'image/png' }),
      ),
    } satisfies PhotoCaptureApi;
    const append = vi.spyOn(document.body, 'append');

    act(() => root.render(createElement(Harness, { captureApi })));
    await act(async () => {
      await download(1024, 'jpg');
    });

    expect(captureApi.capture).toHaveBeenCalledWith(1024, 'jpg');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ download: 'alex-name-keychain-contour-1024px.jpg' }),
    );
    expect(state).toEqual({ status: 'success', resolution: 1024, format: 'jpg' });
  });

  it('reports capture failures without throwing', async () => {
    const captureApi = {
      maxTextureSize: 4096,
      capture: vi.fn(async () => {
        throw new Error('capture failed');
      }),
    } satisfies PhotoCaptureApi;

    act(() => root.render(createElement(Harness, { captureApi })));
    await act(async () => {
      await download(4096);
    });
    expect(state).toMatchObject({
      status: 'error',
      resolution: 4096,
      format: 'png',
      failure: { code: 'photo-capture-failed', message: 'capture failed' },
    });
  });

  it('rejects a capture blob whose MIME does not match the selected format', async () => {
    const captureApi = {
      maxTextureSize: 4096,
      capture: vi.fn(async () => new Blob(['photo'], { type: 'image/png' })),
    } satisfies PhotoCaptureApi;
    const createObjectURL = URL.createObjectURL;

    act(() => root.render(createElement(Harness, { captureApi })));
    await act(async () => {
      await download(1024, 'jpg');
    });

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      status: 'error',
      resolution: 1024,
      format: 'jpg',
      failure: { code: 'photo-format-unsupported' },
    });
  });

  it('rejects resolutions above the renderer texture limit', async () => {
    const captureApi = {
      maxTextureSize: 1024,
      capture: vi.fn(async () => new Blob(['photo'], { type: 'image/png' })),
    } satisfies PhotoCaptureApi;

    act(() => root.render(createElement(Harness, { captureApi })));
    await act(async () => {
      await download(2048);
    });
    expect(captureApi.capture).not.toHaveBeenCalled();
    expect(state).toEqual({ status: 'idle' });
  });

  it('does not create a download after unmount during capture', async () => {
    let resolveCapture: ((blob: Blob) => void) | undefined;
    const captureApi = {
      maxTextureSize: 4096,
      capture: vi.fn(
        () =>
          new Promise<Blob>((resolve) => {
            resolveCapture = resolve;
          }),
      ),
    } satisfies PhotoCaptureApi;
    const createObjectURL = URL.createObjectURL;

    act(() => root.render(createElement(Harness, { captureApi })));
    let pending!: Promise<boolean>;
    await act(async () => {
      pending = download(1024);
      await Promise.resolve();
    });
    act(() => root.unmount());
    await act(async () => {
      resolveCapture?.(new Blob(['photo'], { type: 'image/png' }));
      await pending;
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('removes the anchor when clicking fails and revokes the URL after cleanup delay', async () => {
    const captureApi = {
      maxTextureSize: 4096,
      capture: vi.fn(async () => new Blob(['photo'], { type: 'image/png' })),
    } satisfies PhotoCaptureApi;
    const append = vi.spyOn(document.body, 'append');
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error('download blocked');
    });

    act(() => root.render(createElement(Harness, { captureApi })));
    await act(async () => {
      await download(1024);
    });

    const link = append.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
    expect(link.isConnected).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
    expect(state).toMatchObject({
      status: 'error',
      resolution: 1024,
      format: 'png',
      failure: { code: 'photo-download-blocked', message: 'download blocked' },
    });
  });
});
