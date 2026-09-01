import { Component, type ErrorInfo, type ReactNode } from 'react';

import { type Locale } from '../../../infrastructure/i18n/config';
import { t } from '../../../infrastructure/i18n/utils';
import { resetRetryableLazy } from '../../../shared/ui/RetryableLazy';

type RouteErrorBoundaryProps = {
  locale: Locale;
  resetKey: string;
  children: ReactNode;
};

type RouteErrorBoundaryState = {
  hasError: boolean;
};

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  override state: RouteErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    resetRetryableLazy();
    console.error('Route module failed to load.', error, info);
  }

  override componentDidUpdate(previousProps: RouteErrorBoundaryProps): void {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="route-load-error">
        <p>{t(this.props.locale, 'routeLoadError')}</p>
        <button type="button" onClick={() => window.location.reload()}>
          {t(this.props.locale, 'retry')}
        </button>
      </div>
    );
  }
}
