import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export type RouteLoadingVariant = 'landing' | 'profile' | 'reference' | 'not-found';

const SkeletonMark = () => <span className="route-skeleton__brand" aria-hidden="true" />;

const SkeletonHeader = ({ variant }: { variant: RouteLoadingVariant }) => (
  <header className={`route-skeleton__header route-skeleton__header--${variant}`}>
    <SkeletonMark />
    <span className="route-skeleton__nav" aria-hidden="true" />
    <span className="route-skeleton__action" aria-hidden="true" />
  </header>
);

const LandingSkeleton = () => (
  <main className="route-skeleton__landing">
    <div className="route-skeleton__landing-copy" aria-hidden="true">
      <span className="route-skeleton__line route-skeleton__line--short" />
      <span className="route-skeleton__line route-skeleton__line--title" />
      <span className="route-skeleton__line route-skeleton__line--title route-skeleton__line--wide" />
      <span className="route-skeleton__line route-skeleton__line--body" />
      <span className="route-skeleton__line route-skeleton__line--body route-skeleton__line--wide" />
      <span className="route-skeleton__button" />
    </div>
    <div className="route-skeleton__showcase" aria-hidden="true">
      <span />
    </div>
  </main>
);

const ReferenceSkeleton = ({ variant }: { variant: 'profile' | 'reference' | 'not-found' }) => (
  <main className={`route-skeleton__reference route-skeleton__reference--${variant}`}>
    <div className="route-skeleton__line route-skeleton__line--eyebrow" aria-hidden="true" />
    <div
      className="route-skeleton__line route-skeleton__line--reference-title"
      aria-hidden="true"
    />
    <div className="route-skeleton__line route-skeleton__line--body" aria-hidden="true" />
    {variant === 'profile' ? (
      <section className="route-skeleton__profile-form" aria-hidden="true">
        <span className="route-skeleton__control" />
        <span className="route-skeleton__control" />
        <span className="route-skeleton__button" />
      </section>
    ) : (
      <section className="route-skeleton__article-lines" aria-hidden="true">
        <span />
        <span />
        <span />
      </section>
    )}
  </main>
);

export const RouteLoading = ({
  locale,
  variant,
}: {
  locale: Locale;
  variant: RouteLoadingVariant;
}) => (
  <div
    className={`route-skeleton route-skeleton--${variant}`}
    data-route-skeleton={variant}
    aria-busy="true"
    role="status"
    aria-live="polite"
  >
    <span className="route-skeleton__sr-only">{t(locale, 'routeOpening')}</span>
    <SkeletonHeader variant={variant} />
    {variant === 'landing' ? <LandingSkeleton /> : <ReferenceSkeleton variant={variant} />}
  </div>
);
