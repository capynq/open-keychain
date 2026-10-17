import { useLayoutEffect } from 'react';

/** Motion policy only; native focus-visible continues to own focus presentation. */
export const useInputModality = (): void => {
  useLayoutEffect(() => {
    const element = document.documentElement;
    const previous = element.dataset.inputModality;

    element.dataset.inputModality = 'keyboard';
    const pointer = (): void => {
      if (element.dataset.inputModality !== 'pointer') element.dataset.inputModality = 'pointer';
    };
    const move = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') pointer();
    };
    const keyboard = (event: KeyboardEvent): void => {
      if (['Alt', 'Control', 'Meta', 'Shift'].includes(event.key)) return;
      element.dataset.inputModality = 'keyboard';
    };
    const activation = (event: MouseEvent): void => {
      if (event.detail === 0) element.dataset.inputModality = 'keyboard';
    };

    document.addEventListener('pointerdown', pointer, true);
    document.addEventListener('pointermove', move, { capture: true, passive: true });
    document.addEventListener('keydown', keyboard, true);
    document.addEventListener('click', activation, true);
    return () => {
      document.removeEventListener('pointerdown', pointer, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('keydown', keyboard, true);
      document.removeEventListener('click', activation, true);
      if (previous === undefined) delete element.dataset.inputModality;
      else element.dataset.inputModality = previous;
    };
  }, []);
};
