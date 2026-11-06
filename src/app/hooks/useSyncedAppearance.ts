import { useCallback, useRef, useState, type SetStateAction } from 'react';

import type { PrintAppearanceOverrides } from '../../domain/keychain/model/types';

/**
 * Color overrides whose getter sees every write at once. Undo and redo can apply several color
 * steps in one tick; each step must read the colors the previous step wrote, not the last render.
 */
export const useSyncedAppearance = (initial: PrintAppearanceOverrides) => {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const write = useCallback((next: SetStateAction<PrintAppearanceOverrides>): void => {
    const resolved = typeof next === 'function' ? next(current.current) : next;

    current.current = resolved;
    setValue(resolved);
  }, []);
  const read = useCallback((): PrintAppearanceOverrides => current.current, []);

  return [value, write, read] as const;
};
