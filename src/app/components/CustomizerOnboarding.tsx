import { t, type Locale } from '../../infrastructure/i18n';
import { useAnalytics } from '../../infrastructure/telemetry';
import type { CustomizerGuideState, GuideStepId } from '../hooks/useCustomizerGuide';

const STEPS: GuideStepId[] = ['name', 'shape', 'export'];

export const CustomizerOnboarding = ({
  locale,
  guide,
  printable,
  onExportOpen,
}: {
  locale: Locale;
  guide: CustomizerGuideState;
  printable: boolean;
  onExportOpen: () => void;
}) => {
  const { track } = useAnalytics();

  if (!guide.visible) return null;

  const activateStep = (step: GuideStepId): void => {
    track('customizer_guide_step_clicked', { step });
    if (step === 'export' && printable) {
      onExportOpen();
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-guide-target="${step === 'export' ? 'preview' : step}"]`,
    );
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';

    target?.scrollIntoView({ behavior, block: 'center' });
    if (step === 'name') target?.querySelector<HTMLInputElement>('input')?.focus();
    if (step === 'shape')
      target?.querySelector<HTMLButtonElement>('[data-guide-target="shape-control"]')?.focus();
  };

  const dismiss = (): void => {
    guide.dismiss();
    track('customizer_guide_dismissed');
  };

  return (
    <aside className="customizer-guide" aria-labelledby="customizer-guide-title">
      <div className="customizer-guide-heading">
        <div>
          <p className="eyebrow">{t(locale, 'customizerGuide.label')}</p>
          <h2 id="customizer-guide-title">{t(locale, 'customizerGuide.title')}</h2>
        </div>
        <button
          type="button"
          className="customizer-guide-dismiss"
          aria-label={t(locale, 'customizerGuide.dismiss')}
          onClick={dismiss}
        >
          ×
        </button>
      </div>
      <ol className="customizer-guide-steps">
        {STEPS.map((step, index) => (
          <li key={step} className={guide.activeStep === step ? 'active' : undefined}>
            <button
              type="button"
              aria-label={`${t(locale, 'customizerGuide.stepAction')} ${index + 1}`}
              aria-describedby={`customizer-guide-step-${step}`}
              aria-current={guide.activeStep === step ? 'step' : undefined}
              onClick={() => activateStep(step)}
            >
              <span className="customizer-guide-number">{String(index + 1).padStart(2, '0')}</span>
              <span id={`customizer-guide-step-${step}`}>
                <strong>{t(locale, `customizerGuide.steps.${step}.title`)}</strong>
                <small>{t(locale, `customizerGuide.steps.${step}.body`)}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
};
