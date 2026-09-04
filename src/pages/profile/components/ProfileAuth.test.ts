// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProfileAuth } from './ProfileAuth';

describe('ProfileAuth form contract', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());

    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('keeps signup controls natively discoverable and constrained', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        ProfileAuth({
          locale: 'en',
          authMode: 'sign-up',
          name: '',
          email: '',
          password: '',
          authBusy: false,
          onNameChange: vi.fn(),
          onEmailChange: vi.fn(),
          onPasswordChange: vi.fn(),
          onSubmit: vi.fn(),
          onToggleMode: vi.fn(),
        }),
      );
    });

    const form = container.querySelector('form');
    const inputs = [...container.querySelectorAll('input')];
    expect(form).not.toBeNull();
    expect(inputs).toHaveLength(3);
    expect(inputs.map((input) => input.type)).toEqual(['text', 'email', 'password']);
    expect(inputs.every((input) => input.required)).toBe(true);
    expect(inputs[2].minLength).toBe(10);
    expect(form?.querySelector('button[type="submit"]')).not.toBeNull();
    expect(form?.querySelectorAll('button[type="button"]')).toHaveLength(1);
  });
});
