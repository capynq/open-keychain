import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';
import { TEMPLATE_SHOWCASE } from './content';
import { LandingSectionHeading } from './LandingSectionHeading';
import { TemplatePreviewCard } from './TemplatePreviewCard';

export const LandingTemplates = ({ locale }: { locale: Locale }) => (
  <section
    className="landing-section landing-products"
    id="products"
    aria-labelledby="products-title"
  >
    <LandingSectionHeading
      kicker={t(locale, 'landing.productsKicker')}
      title={t(locale, 'landing.productsTitle')}
      titleId="products-title"
    />
    <div className="landing-product-grid">
      {TEMPLATE_SHOWCASE.map((template) => (
        <TemplatePreviewCard key={template.id} locale={locale} template={template} />
      ))}
    </div>
  </section>
);
