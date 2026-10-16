import { useState } from 'react';

export type EditorMode = 'simple' | 'pro';

const STORAGE_KEY = 'open-keychain:editor-mode';

export const useEditorMode = () => {
  const [mode, setMode] = useState<EditorMode>(() => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) === 'pro'
        ? 'pro'
        : 'simple';
    } catch {
      return 'simple';
    }
  });

  const changeMode = (next: EditorMode): void => {
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The editor remains usable when browser storage is unavailable.
    }
  };

  return { mode, changeMode };
};
