import type { ReactNode } from 'react';

import { Link } from 'react-router';

import type { Locale } from '../../../infrastructure/i18n/config';
import type { SeoCtaClick } from '../model/types';

import { createPath } from '../../../shared/lib/create-path';

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
