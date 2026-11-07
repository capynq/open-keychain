// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';

import { useRoutePreload } from './useRoutePreload';

const { prewarmGeometryClient, preloadCreateRoute } = vi.hoisted(() => ({
  prewarmGeometryClient: vi.fn(),
  preloadCreateRoute: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../infrastructure/geometry/geometry-client-pool', () => ({ prewarmGeometryClient }));
vi.mock('../routing/routeModules', () => ({ preloadCreateRoute }));

const host = document.createElement('div');
let root: ReturnType<typeof createRoot> | undefined;

const Harness = () => {
  useRoutePreload();
  return null;
};

const mount = (href: string) => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

  const anchor = document.createElement('a');

  anchor.href = href;
  document.body.append(anchor);

  root = createRoot(host);
  act(() => root!.render(createElement(Harness)));
  return anchor;
};

const intent = (anchor: HTMLAnchorElement, type: string) =>
  anchor.dispatchEvent(new Event(type, { bubbles: true }));

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;

  document.body.replaceChildren();
  window.history.replaceState({}, '', '/');
  prewarmGeometryClient.mockClear();
  preloadCreateRoute.mockClear();
  vi.unstubAllGlobals();
});

it.each(['pointerover', 'focusin', 'touchstart'])(
  'prewarms the geometry client and the customizer chunk on %s create-link intent',
  async (type) => {
    intent(mount('/create'), type);

    await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
    expect(preloadCreateRoute).toHaveBeenCalledTimes(1);
  },
);

it('treats the hero name form as editor intent', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const form = document.createElement('form');

  form.dataset.preloadRoute = 'create';
  const input = document.createElement('input');

  form.append(input);
  document.body.append(form);
  root = createRoot(host);
  act(() => root!.render(createElement(Harness)));

  input.dispatchEvent(new Event('focusin', { bubbles: true }));

  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
  expect(preloadCreateRoute).toHaveBeenCalledTimes(1);
});

it('treats a trailing-slash create link as the create route', async () => {
  intent(mount('/create/'), 'pointerover');

  await vi.waitFor(() => expect(prewarmGeometryClient).toHaveBeenCalledTimes(1));
});

it('ignores intent on links that are not the customizer route', async () => {
  intent(mount('/privacy'), 'pointerover');
  await Promise.resolve();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
  expect(preloadCreateRoute).not.toHaveBeenCalled();
});

it('does not prewarm for a cross-origin link to the create path', async () => {
  intent(mount('https://other.example/create'), 'pointerover');
  await Promise.resolve();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
  expect(preloadCreateRoute).not.toHaveBeenCalled();
});

it('skips the prewarm but still preloads the chunk when already on the create route', async () => {
  window.history.replaceState({}, '', '/create');

  intent(mount('/create'), 'pointerover');

  await vi.waitFor(() => expect(preloadCreateRoute).toHaveBeenCalledTimes(1));
  expect(prewarmGeometryClient).not.toHaveBeenCalled();
});

it('removes its listeners on unmount', async () => {
  const anchor = mount('/create');

  act(() => root?.unmount());
  root = undefined;

  intent(anchor, 'pointerover');
  intent(anchor, 'focusin');
  intent(anchor, 'touchstart');
  await Promise.resolve();

  expect(prewarmGeometryClient).not.toHaveBeenCalled();
  expect(preloadCreateRoute).not.toHaveBeenCalled();
});
