// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProfileSaveCard } from './ProfileSaveCard';

describe('ProfileSaveCard WebMCP form contract', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());

    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('annotates only the human-confirmed project save form', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        createElement(ProfileSaveCard, {
          locale: 'en',
          canSaveCurrent: true,
          projectName: 'Mira',
          defaultProjectName: 'Untitled',
          saveBusy: false,
          onProjectNameChange: vi.fn(),
          onSave: vi.fn(),
          onSignOut: vi.fn(),
        }),
      );
    });

    const form = container.querySelector('form');
    const input = container.querySelector('input');
    expect(form?.getAttribute('toolname')).toBe('save-keychain-project');
    expect(form?.getAttribute('tooldescription')).toContain('person must submit');
    expect(form?.hasAttribute('toolautosubmit')).toBe(false);
    expect(input?.getAttribute('name')).toBe('projectName');
    expect(input?.getAttribute('toolparamdescription')).toBeTruthy();
  });
});
