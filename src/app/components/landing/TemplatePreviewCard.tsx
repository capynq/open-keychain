import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';
import type { TemplateShowcase } from './content';

export const TemplatePreviewCard = ({
  locale,
  template,
}: {
  locale: Locale;
  template: TemplateShowcase;
}) => (
  <article className={`landing-template-card landing-template-card-${template.id}`}>
    <div className="landing-template-image-wrap">
      <img src={template.assetPath} alt={t(locale, template.altKey)} width="640" height="360" />
    </div>
    <h3>{t(locale, template.titleKey)}</h3>
    <p>{t(locale, template.bodyKey)}</p>
  </article>
);
