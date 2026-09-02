import { Link } from 'react-router';

import type { Locale } from '../../../../infrastructure/i18n/config';

import { t } from '../../../../infrastructure/i18n/utils';
import { templateCreatePath, type TemplateShowcase } from '../content';
import styles from './TemplatePreviewCard.module.css';

export const TemplatePreviewCard = ({
  locale,
  template,
}: {
  locale: Locale;
  template: TemplateShowcase;
}) => (
  <article className={`${styles.root} landing-template-card landing-template-card-${template.id}`}>
    <div className="landing-template-image-wrap">
      <img src={template.assetPath} alt={t(locale, template.altKey)} width="640" height="360" />
    </div>
    <h3>{t(locale, template.titleKey)}</h3>
    <p>{t(locale, template.bodyKey)}</p>
    <Link className="landing-template-card-action" to={templateCreatePath(locale, template.id)}>
      {t(locale, 'landing.chooseTemplate')}
      <span aria-hidden="true">→</span>
    </Link>
  </article>
);
