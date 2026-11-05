import { useLayoutEffect } from 'react';

/**
 * Publishes the live customizer header height as `--customizer-topbar-height`, so the sticky
 * phone preview sits right below it even when enlarged text wraps the header onto two rows.
 */
export const useStickyHeaderOffset = (): void => {
  useLayoutEffect(() => {
    const header = document.querySelector<HTMLElement>(
      'main.customizer-app-shell:not(.customizer-boot-frame) .customizer-topbar',
    );
    const shell = header?.closest<HTMLElement>('.customizer-app-shell');
    if (!header || !shell) return undefined;
    const update = (): void => {
      shell.style.setProperty(
        '--customizer-topbar-height',
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    };
    const observer = new ResizeObserver(update);

    observer.observe(header);
    update();
    return () => {
      observer.disconnect();
      shell.style.removeProperty('--customizer-topbar-height');
    };
  }, []);
};
