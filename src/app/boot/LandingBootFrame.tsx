import type { Locale } from '@/infrastructure/i18n';

import { AppHeader } from '@/app/components/AppHeader/AppHeader';
import { LandingHero } from '@/app/components/landing/LandingHero/LandingHero';
import { LandingWorkflow } from '@/app/components/landing/LandingWorkflow/LandingWorkflow';

const noop = (): void => {};

/**
 * The landing page's first screen, rendered at build time and painted before React runs. It is
 * the live markup (header, hero and the section that shows below it on tall screens) inside the
 * same shell, so the hand-off swaps identical layout; stylesheets come from the LandingPage chunk.
 */
export const LandingBootFrame = ({ locale }: { locale: Locale }) => (
  <div className="landing-shell landing-boot-frame">
    <AppHeader locale={locale} onLocaleChange={noop} />
    <main>
      <LandingHero locale={locale} />
      <LandingWorkflow locale={locale} />
    </main>
  </div>
);
