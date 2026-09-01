import { isBrowser } from './browser';

const copyWithLegacyCommand = (value: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  const body = document.body;

  if (!body) return false;

  body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
};

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
      return copyWithLegacyCommand(value);
    }
  }

  return copyWithLegacyCommand(value);
};
