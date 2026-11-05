import { useLayoutEffect } from 'react';

const TEXT_INPUT = "input:is([type='text'], [type='search'], :not([type])), textarea";

/**
 * Keeps the phone preview pinned under the header without moving it under a finger:
 * - publishes the live header height as `--customizer-topbar-height`, so the preview sits right
 *   below it even when enlarged text wraps the header onto two rows;
 * - unpins the preview while a sidebar text field has focus (the on-screen keyboard needs room)
 *   and pins it again only on the next scroll, so the tap that ends typing lands where aimed.
 */
export const useStickyPreview = (): void => {
  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(
      'main.customizer-app-shell:not(.customizer-boot-frame)',
    );
    const header = shell?.querySelector<HTMLElement>('.customizer-topbar');
    if (!shell || !header) return undefined;
    const update = (): void => {
      shell.style.setProperty(
        '--customizer-topbar-height',
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    };
    const typing = (): boolean =>
      document.activeElement instanceof HTMLElement &&
      shell.contains(document.activeElement) &&
      document.activeElement.matches(`.controls-panel ${TEXT_INPUT}`);
    const onFocusIn = (): void => {
      if (typing()) shell.dataset.previewUnpinned = 'true';
    };
    const onScroll = (): void => {
      if (shell.dataset.previewUnpinned && !typing()) delete shell.dataset.previewUnpinned;
    };
    const observer = new ResizeObserver(update);

    observer.observe(header);
    update();
    shell.addEventListener('focusin', onFocusIn);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      shell.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('scroll', onScroll);
      shell.style.removeProperty('--customizer-topbar-height');
      delete shell.dataset.previewUnpinned;
    };
  }, []);
};
