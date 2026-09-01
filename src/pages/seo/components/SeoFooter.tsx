import { LandingFooter } from '@/app/components/landing/LandingFooter/LandingFooter';

import type { Locale } from '../../../infrastructure/i18n/config';

export const SeoFooter = ({ locale }: { locale: Locale }) => <LandingFooter locale={locale} />;
