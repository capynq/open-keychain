import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { BrowserRouter } from 'react-router';
import App from './app/App';
import { AnalyticsProvider } from './infrastructure/analytics';
import './infrastructure/i18n/config';
import './app/styles/global.css';

const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.query_string;
        delete event.request.url;
      }
      return event;
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
      <AnalyticsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AnalyticsProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
