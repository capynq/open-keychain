import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from '@/app/App/App';
import { detectInitialLocale } from '@/app/seo';
import { loadLocale } from '@/infrastructure/i18n/config';
import { AnalyticsProvider } from '@/infrastructure/telemetry';
import '@/app/styles/tokens.css';
import '@/app/styles/global.css';
import { installGlobalErrorLog } from '@/shared/lib/support/error-log';

installGlobalErrorLog();

const render = (): void =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AnalyticsProvider>
        <BrowserRouter useTransitions>
          <App />
        </BrowserRouter>
      </AnalyticsProvider>
    </StrictMode>,
  );

/* The first render waits for its locale (the document preloads it), so a Russian or Ukrainian
 * page never paints English first. A failed load renders with the English fallback. */
void loadLocale(detectInitialLocale(window.location.search, window.location.pathname))
  .catch(() => undefined)
  .then(render);
