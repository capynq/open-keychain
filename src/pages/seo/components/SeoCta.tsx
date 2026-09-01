import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { createPath } from '../../../shared/lib/create-path';
import type { Locale } from '../../../infrastructure/i18n';
import type { SeoCtaClick } from '../model';

export const CreateLink = ({
  locale,
  onCtaClick,
  cta,
  children,
}: {
  locale: Locale;
  onCtaClick?: SeoCtaClick;
  cta: string;
  children: ReactNode;
}) => (
  <Link className="seo-cta" to={createPath(locale)} onClick={() => onCtaClick?.(locale, cta)}>
    {children}
  </Link>
);
