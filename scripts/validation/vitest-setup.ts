/*
 * The app loads Russian and Ukrainian on demand; unit tests render every locale, so they start
 * with all of them loaded, as the build-time boot frame renderer does.
 */
import { loadLocale, supportedLocales } from '../../src/infrastructure/i18n/config';

await Promise.all(supportedLocales.map((locale) => loadLocale(locale)));
