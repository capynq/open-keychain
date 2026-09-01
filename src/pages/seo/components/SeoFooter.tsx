import type { Locale } from '../../../infrastructure/i18n';
import { LandingFooter } from '../../../components/LandingFooter/LandingFooter';

export const SeoFooter = ({ locale }: { locale: Locale }) => <LandingFooter locale={locale} />;
