// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGeometryPrewarmRelease } from './useGeometryPrewarmRelease';

const { releasePrewarmedGeometry } = vi.hoisted(() => ({ releasePrewarmedGeometry: vi.fn() }));

vi.mock('../routing/geometryPrewarm', () => ({ releasePrewarmedGeometry }));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;

const Harness = ({ pathname }: { pathname: string }) => {
  useGeometryPrewarmRelease(pathname);
  return null;
};

const render = (pathname: string) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root ??= createRoot(host);
  act(() => root!.render(createElement(Harness, { pathname })));
};

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  releasePrewarmedGeometry.mockClear();
  vi.unstubAllGlobals();
});

describe('useGeometryPrewarmRelease', () => {
  it.each(['/', '/ru/', '/create', '/create/'])('keeps the pooled client on %s', (pathname) => {
    render(pathname);

    expect(releasePrewarmedGeometry).not.toHaveBeenCalled();
  });

  it.each(['/privacy', '/profile'])('releases the pooled client when landing on %s', (pathname) => {
    render(pathname);

    expect(releasePrewarmedGeometry).toHaveBeenCalledTimes(1);
  });

  it('releases when leaving the landing page for another route', () => {
    render('/');
    expect(releasePrewarmedGeometry).not.toHaveBeenCalled();

    render('/privacy');
    expect(releasePrewarmedGeometry).toHaveBeenCalledTimes(1);
  });

  it('keeps the pooled client when moving from the landing page to the create route', () => {
    render('/');
    render('/create');

    expect(releasePrewarmedGeometry).not.toHaveBeenCalled();
  });
});
