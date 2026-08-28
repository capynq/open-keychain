import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from '@/app/App/App';
import { AnalyticsProvider } from '@/infrastructure/telemetry';
import '@/infrastructure/i18n/config';
import '@/app/styles/tokens.css';
import '@/app/styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AnalyticsProvider>
  </StrictMode>,
);
