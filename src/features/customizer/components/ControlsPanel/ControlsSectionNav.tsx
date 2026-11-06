import { useEffect, useState, type RefObject } from 'react';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';
import { activationMotion, navigationMotion } from '@/shared/lib/motion';

type ControlsNavSection = { id: string; labelKey: string; selector: string };

const CONTROLS_NAV_SECTIONS: readonly ControlsNavSection[] = [
  { id: 'name', labelKey: 'name', selector: '[data-control-group="name"]' },
  { id: 'template', labelKey: 'template', selector: '[data-control-group="template"]' },
  { id: 'style', labelKey: 'style', selector: '[data-control-group="style"]' },
  { id: 'font', labelKey: 'font', selector: '.refine-settings' },
  { id: 'colors', labelKey: 'navColors', selector: '[data-control-group="appearance"]' },
  { id: 'adjust', labelKey: 'navAdjust', selector: '[data-control-group="adjustments"]' },
];

/**
 * Jump links to each part of the desktop sidebar; the current part follows scrolling.
 * The visible links come from props, not the DOM, so the boot frame and the live editor match.
 */
export const ControlsSectionNav = ({
  locale,
  panelRef,
  hiddenSections = [],
}: {
  locale: Locale;
  panelRef: RefObject<HTMLElement | null>;
  hiddenSections?: string[];
}) => {
  const [active, setActive] = useState<string>('name');
  const sections = CONTROLS_NAV_SECTIONS.filter((section) => !hiddenSections.includes(section.id));

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    let frame = 0;
    const update = (): void => {
      frame = 0;
      const top = panel.getBoundingClientRect().top + 72;
      const present = CONTROLS_NAV_SECTIONS.filter((section) =>
        panel.querySelector(section.selector),
      );
      let current = present[0]?.id ?? 'name';
      for (const section of present) {
        const element = panel.querySelector<HTMLElement>(section.selector);
        if (element && element.getBoundingClientRect().top <= top) current = section.id;
      }
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2 && present.length)
        current = present[present.length - 1].id;
      setActive(current);
    };
    const schedule = (): void => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const observer = new MutationObserver(schedule);

    observer.observe(panel, { childList: true, subtree: true });
    panel.addEventListener('scroll', schedule, { passive: true });
    update();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      panel.removeEventListener('scroll', schedule);
    };
  }, [panelRef]);

  return (
    <nav className="controls-section-nav" aria-label={t(locale, 'controlsSections')}>
      {sections.map((section) => (
        <button
          type="button"
          key={section.id}
          aria-current={active === section.id ? 'true' : undefined}
          onClick={(event) => {
            const target = panelRef.current?.querySelector<HTMLElement>(section.selector);
            if (!target) return;
            target.scrollIntoView({
              block: 'start',
              behavior: navigationMotion(activationMotion(event)) === 'smooth' ? 'smooth' : 'auto',
            });
            target
              .querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')
              ?.focus({ preventScroll: true });
            setActive(section.id);
          }}
        >
          {t(locale, section.labelKey)}
        </button>
      ))}
    </nav>
  );
};
