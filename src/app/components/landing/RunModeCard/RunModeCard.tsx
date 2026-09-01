import { Link } from 'react-router';
import type { Locale } from '../../../../infrastructure/i18n';
import { t } from '../../../../infrastructure/i18n';
import { createPath, type RunOption } from '../content';
import styles from './RunModeCard.module.css';

export const RunModeCard = ({ locale, option }: { locale: Locale; option: RunOption }) => (
  <article className={`${styles.root} landing-run-card landing-run-card-${option}`}>
    <p>{t(locale, `landing.run.${option}.eyebrow`)}</p>
    <h3>{t(locale, `landing.run.${option}.title`)}</h3>
    <span>{t(locale, `landing.run.${option}.status`)}</span>
    <ul>
      {[0, 1, 2].map((item) => (
        <li key={item}>{t(locale, `landing.run.${option}.items.${item}`)}</li>
      ))}
    </ul>
    {option === 'browser' && (
      <Link to={createPath(locale)} className="landing-card-link">
        {t(locale, 'landing.startDesigning')} <span aria-hidden="true">→</span>
      </Link>
    )}
    {option === 'selfHost' && (
      <a href="https://github.com/capynq/open-keychain" className="landing-card-link">
        {t(locale, 'landing.viewSource')} <span aria-hidden="true">→</span>
      </a>
    )}
  </article>
);
