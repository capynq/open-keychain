import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';

export const ConfiguratorShowcase = ({ locale }: { locale: Locale }) => (
  <figure className="configurator-showcase" aria-label={t(locale, 'landing.previewLabel')}>
    <div className="configurator-window">
      <div className="configurator-window-bar">
        <span className="configurator-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="configurator-window-label">
          <span className="configurator-desktop-label">
            {t(locale, 'landing.desktopWorkspace')}
          </span>
          <span className="configurator-mobile-label">{t(locale, 'landing.mobileWorkspace')}</span>
        </span>
        <span className="configurator-window-status">{t(locale, 'landing.localBadge')}</span>
      </div>
      <picture>
        <source media="(max-width: 760px)" srcSet="/showcase/create-mobile.png" />
        <img
          src="/showcase/create-desktop.png"
          alt={t(locale, 'landing.previewAlt')}
          width="1440"
          height="900"
        />
      </picture>
    </div>
    <figcaption className="configurator-showcase-caption">
      <span>{t(locale, 'landing.previewTag')}</span>
      <span aria-hidden="true">·</span>
      <span>{t(locale, 'landing.previewCaption')}</span>
    </figcaption>
  </figure>
);
