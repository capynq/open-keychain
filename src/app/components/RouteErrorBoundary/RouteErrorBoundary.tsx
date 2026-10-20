import { Component, type ReactNode } from 'react';

import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import { type Locale } from '../../../infrastructure/i18n/config';
import { recoveryMessage, recoverySteps, t } from '../../../infrastructure/i18n/utils';
import { captureReactException } from '../../../infrastructure/telemetry/react-exceptions';
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

  override componentDidCatch(error: Error): void {
    const root = document.getElementById('root');

    root?.removeAttribute('inert');
    root?.setAttribute('data-app-ready', 'true');
    document.documentElement.setAttribute('data-app-ready', 'true');
    resetRetryableLazy();
    captureReactException(error);
    console.error('Route module failed to load.');
  }

  override componentDidUpdate(previousProps: RouteErrorBoundaryProps): void {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="route-load-error">
        <RecoveryNotice
          role="alert"
          message={recoveryMessage(this.props.locale, { code: 'route-load-failed' })}
          steps={recoverySteps(this.props.locale, { code: 'route-load-failed' })}
          detailsLabel={t(this.props.locale, 'recoveryDetails')}
          actions={[
            {
              id: 'reload',
              label: t(this.props.locale, 'recoveryReload'),
              onAction: () => window.location.reload(),
            },
          ]}
        />
      </div>
    );
  }
}
