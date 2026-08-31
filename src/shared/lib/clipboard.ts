import { isBrowser } from './browser';

/**
 * Copy text using the modern clipboard API, falling back to the legacy
 * selection command. Returns false when the browser cannot copy the value.
 */
export const copyTextToClipboard = async (value: string): Promise<boolean> => {
  if (!isBrowser()) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);

      return true;
    } catch {
      // Continue with the legacy clipboard fallback.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  const body = document.body;

  if (!body) return false;

  body.appendChild(textarea);
  try {
    textarea.select();

    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
};
