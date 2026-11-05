import { useEffect, useRef } from 'react';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);

const editsText = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true;
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
};

/** Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z or Ctrl+Y redoes design edits outside text fields. */
export const useUndoShortcuts = (undo: () => void, redo: () => void): void => {
  const actions = useRef({ undo, redo });

  useEffect(() => {
    actions.current = { undo, redo };
  }, [undo, redo]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (editsText(event.target) || document.querySelector('[aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
      if (key !== 'z' && !isRedo) return;
      event.preventDefault();
      if (isRedo) actions.current.redo();
      else actions.current.undo();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
};
