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
      <picture>
        <source
          type="image/avif"
          srcSet={`/showcase/v1/templates/${template.modernAssetName}-320.avif 320w, /showcase/v1/templates/${template.modernAssetName}-640.avif 640w`}
          sizes="(max-width: 760px) calc((100vw - 54px) / 2), (max-width: 1000px) calc((100vw - 84px) / 2), 285px"
        />
        <source
          type="image/webp"
          srcSet={`/showcase/v1/templates/${template.modernAssetName}-320.webp 320w, /showcase/v1/templates/${template.modernAssetName}-640.webp 640w`}
          sizes="(max-width: 760px) calc((100vw - 54px) / 2), (max-width: 1000px) calc((100vw - 84px) / 2), 285px"
        />
        <img
          src={template.assetPath}
          alt={t(locale, template.altKey)}
          width="640"
          height="360"
          loading="lazy"
          decoding="async"
        />
      </picture>
    </div>
    <h3>{t(locale, template.titleKey)}</h3>
    <p>{t(locale, template.bodyKey)}</p>
    <Link className="landing-template-card-action" to={templateCreatePath(locale, template.id)}>
      {t(locale, 'landing.chooseTemplate')}
      <span aria-hidden="true">→</span>
    </Link>
  </article>
);
