import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FONT_CATALOG,
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
  fontSupportsText,
  textUsesCyrillic,
} from './fonts/catalog';
import { GeometryClient } from './geometry/client';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  type ExportFormat,
  type GeometryResult,
  type KeychainParams,
  type ThreeMfMode,
} from './geometry/types';
import { STYLE_CATALOG } from './geometry/styles';
import { TEMPLATE_CATALOG } from './geometry/templates';
import { hasTemplateParameter, PARAMETER_RANGES } from './geometry/parameters';
import { detectLocale, issueMessage, styleName, templateName, t, type Locale } from './i18n/utils';
import { Viewer, type SurfacePresetId } from './viewer/Viewer';
import {
  completeExportIntent,
  currentUser,
  hostedMode,
  listProjects,
  saveProject,
  signIn,
  signOut,
  signUp,
  type HostedProject,
  type HostedUser,
  requestExportIntent,
} from './hosted/api';
import './app.css';

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span className="control-label">
        <span>{label}</span>
        <span>
          {value.toFixed(1)} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </label>
  );
}

function App() {
  const { i18n } = useTranslation();
  const clientRef = useRef<GeometryClient | undefined>(undefined);
  const resultRef = useRef<GeometryResult | undefined>(undefined);
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>(
    () => (localStorage.getItem('open-keychain-surface') as SurfacePresetId) || 'matte',
  );
  const [exportOpen, setExportOpen] = useState(false);
  const [params, setParams] = useState<KeychainParams>(() => {
    try {
      const saved = localStorage.getItem('open-keychain-preferences');
      const next = saved ? normalizeParams({ ...DEFAULT_PARAMS, ...JSON.parse(saved) }) : DEFAULT_PARAMS;
      const current = fontDefinition(next.fontId);
      if (next.templateId === 'articulated-name' && !fontSupportsArticulatedName(current, next.text))
        next.fontId = articulatedFallbackFont(next.text).id;
      else if (!fontSupportsText(current, next.text))
        next.fontId = FONT_CATALOG.find((font) => fontSupportsText(font, next.text))?.id ?? DEFAULT_PARAMS.fontId;
      return next;
    } catch {
      return DEFAULT_PARAMS;
    }
  });
  const [result, setResult] = useState<GeometryResult>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const [fontNotice, setFontNotice] = useState<{ font: string; replacement: string; articulated?: boolean }>();
  const [account, setAccount] = useState<HostedUser>();
  const [projects, setProjects] = useState<HostedProject[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const selectedFont = useMemo(
    () => FONT_CATALOG.find((font) => font.id === params.fontId) ?? FONT_CATALOG[0],
    [params.fontId],
  );
  const activeTemplate = useMemo(
    () => TEMPLATE_CATALOG.find((template) => template.id === params.templateId) ?? TEMPLATE_CATALOG[0],
    [params.templateId],
  );
  const availableStyles = useMemo(
    () => STYLE_CATALOG.filter((style) => activeTemplate.styles.includes(style.id)),
    [activeTemplate],
  );
  const showsParameter = (parameter: keyof KeychainParams) => hasTemplateParameter(params.templateId, parameter);
  const usesCyrillic = textUsesCyrillic(params.text);

  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  useEffect(() => {
    if (!exportOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [exportOpen]);

  useEffect(() => {
    localStorage.setItem('open-keychain-locale', locale);
  }, [locale]);
  useEffect(() => {
    localStorage.setItem('open-keychain-surface', surfacePreset);
  }, [surfacePreset]);
  useEffect(() => {
    if (!hostedMode) return;
    void currentUser().then((user) => {
      setAccount(user);
      if (user)
        void listProjects()
          .then(setProjects)
          .catch(() => setProjects([]));
    });
  }, []);
  useEffect(() => {
    const client = new GeometryClient();
    clientRef.current = client;
    return () => client.dispose();
  }, []);
  useEffect(() => {
    localStorage.setItem(
      'open-keychain-preferences',
      JSON.stringify({
        fontId: params.fontId,
        templateId: params.templateId,
        styleId: params.styleId,
        textHeightMm: params.textHeightMm,
        baseThicknessMm: params.baseThicknessMm,
        reliefDepthMm: params.reliefDepthMm,
        paddingMm: params.paddingMm,
        letterSpacingMm: params.letterSpacingMm,
        holeDiameterMm: params.holeDiameterMm,
        connectorWidthMm: params.connectorWidthMm,
        cornerRadiusMm: params.cornerRadiusMm,
        stakeLengthMm: params.stakeLengthMm,
        jointClearanceMm: params.jointClearanceMm,
        mechanicalGapMm: params.mechanicalGapMm,
        maxJointAngleDeg: params.maxJointAngleDeg,
        minimumWallMm: params.minimumWallMm,
        bottomClearanceMm: params.bottomClearanceMm,
      }),
    );
    const timer = window.setTimeout(
      () => {
        setBusy(true);
        setError(undefined);
        clientRef.current
          ?.request(params)
          .then((next) => {
            setResult(next);
            setBusy(false);
          })
          .catch((cause: Error) => {
            setBusy(false);
            setError(cause.message);
          });
      },
      resultRef.current ? 90 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [params]);

  const update = <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => {
    setFontNotice(undefined);
    setParams((current) => ({ ...current, [key]: value }));
  };
  const updateText = (text: string) => {
    const currentFont = fontDefinition(params.fontId);
    const requiresArticulatedFont = params.templateId === 'articulated-name';
    const compatible = requiresArticulatedFont
      ? fontSupportsArticulatedName(currentFont, text)
      : fontSupportsText(currentFont, text);
    const replacement = compatible
      ? undefined
      : requiresArticulatedFont
        ? articulatedFallbackFont(text)
        : FONT_CATALOG.find((font) => fontSupportsText(font, text));
    if (replacement)
      setFontNotice({ font: currentFont.name, replacement: replacement.name, articulated: requiresArticulatedFont });
    setParams((current) => ({
      ...current,
      text,
      fontId: replacement?.id ?? current.fontId,
    }));
  };
  const selectTemplate = (templateId: KeychainParams['templateId']) => {
    setFontNotice(undefined);
    const selected = fontDefinition(params.fontId);
    const previewReplacement =
      templateId === 'articulated-name' && !fontSupportsArticulatedName(selected, params.text)
        ? articulatedFallbackFont(params.text)
        : undefined;
    if (previewReplacement)
      setFontNotice({ font: selected.name, replacement: previewReplacement.name, articulated: true });
    setParams((current) => {
      const currentFont = fontDefinition(current.fontId);
      const replacement =
        templateId === 'articulated-name' && !fontSupportsArticulatedName(currentFont, current.text)
          ? articulatedFallbackFont(current.text)
          : undefined;
      return {
        ...current,
        templateId,
        fontId: replacement?.id ?? current.fontId,
        baseThicknessMm:
          templateId === 'articulated-name' ? Math.max(3.4, current.baseThicknessMm) : current.baseThicknessMm,
      };
    });
  };
  const errorIssue = result?.issues.find((item) => item.severity === 'error');
  const warningIssue = result?.issues.find((item) => item.severity === 'warning');
  const needsAttention = Boolean(error || (!busy && result && (!result.printable || errorIssue)));
  const statusClass = busy ? 'updating' : needsAttention ? 'attention' : warningIssue ? 'adjusted' : 'ready';
  const statusText = busy
    ? t(locale, 'updating')
    : needsAttention
      ? t(locale, 'needsAttention')
      : warningIssue
        ? t(locale, 'adjusted')
        : t(locale, 'ready');
  const download = async (format: ExportFormat, mode: ThreeMfMode = 'separate-colors') => {
    if (!result?.printable || downloading) return;
    setDownloading(true);
    let exportToken: string | undefined;
    try {
      if (hostedMode) exportToken = (await requestExportIntent()).token;
      const file = await clientRef.current?.export(params, format, mode);
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (exportToken) await completeExportIntent(exportToken);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The file could not be created.');
    } finally {
      setDownloading(false);
    }
  };
  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(undefined);
    try {
      const response =
        authMode === 'sign-up'
          ? await signUp(authName, authEmail, authPassword)
          : await signIn(authEmail, authPassword);
      setAccount(response.user);
      setProjects(await listProjects());
      setAuthPassword('');
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };
  const saveCurrentProject = async () => {
    if (!account) return;
    const name = window.prompt('Project name', params.text || 'Untitled keychain')?.trim();
    if (!name) return;
    try {
      const response = await saveProject(name, params as unknown as Record<string, unknown>);
      setProjects((current) => [response.project, ...current.filter((project) => project.id !== response.project.id)]);
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : 'Project could not be saved.');
      setAccountOpen(true);
    }
  };
  const feedback =
    error ??
    (errorIssue
      ? issueMessage(locale, errorIssue)
      : warningIssue
        ? issueMessage(locale, warningIssue)
        : !busy && result && !result.printable
          ? t(locale, 'errorNotReady')
          : undefined);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <img src="/brand/open-keychain-mark.svg" alt="" width="34" height="34" />
          <div>
            <h1>Open Keychain</h1>
            <small>{t(locale, 'brandTagline')}</small>
          </div>
        </div>
        <div className="topbar-actions">
          <label className="language-picker">
            <span className="sr-only">{t(locale, 'language')}</span>
            <select
              value={locale}
              onChange={(event) => {
                const next = event.target.value as Locale;
                setLocale(next);
                void i18n.changeLanguage(next);
              }}
            >
              <option value="en">EN</option>
              <option value="ru">RU</option>
              <option value="uk">UK</option>
            </select>
          </label>
          <a href="https://github.com/WilfredoN/open-keychain" className="github-link">
            {t(locale, 'openSource')}
          </a>
          <button
            type="button"
            className="export-header-button"
            onClick={() => setExportOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={exportOpen}
          >
            {t(locale, 'export')}
          </button>
          {hostedMode && (
            <div className="account-menu">
              <button type="button" className="account-button" onClick={() => setAccountOpen((open) => !open)}>
                {account ? account.name : t(locale, 'signIn')}
              </button>
              {accountOpen && (
                <div className="account-popover">
                  {account ? (
                    <>
                      <strong>{t(locale, 'gallery')}</strong>
                      <div className="project-list">
                        {projects.length ? (
                          projects.map((project) => (
                            <button
                              type="button"
                              key={project.id}
                              onClick={() => {
                                setParams(normalizeParams({ ...DEFAULT_PARAMS, ...project.params }));
                                setAccountOpen(false);
                              }}
                            >
                              {project.name}
                            </button>
                          ))
                        ) : (
                          <small>{t(locale, 'galleryEmpty')}</small>
                        )}
                      </div>
                      <button type="button" onClick={() => void saveCurrentProject()}>
                        {t(locale, 'saveProject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void signOut().then(() => {
                            setAccount(undefined);
                            setProjects([]);
                          });
                        }}
                      >
                        {t(locale, 'signOut')}
                      </button>
                    </>
                  ) : (
                    <form onSubmit={submitAuth} className="account-form">
                      <strong>{authMode === 'sign-up' ? t(locale, 'createAccount') : t(locale, 'signIn')}</strong>
                      {authMode === 'sign-up' && (
                        <input
                          value={authName}
                          onChange={(event) => setAuthName(event.target.value)}
                          placeholder={t(locale, 'fullName')}
                          required
                        />
                      )}
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(event) => setAuthEmail(event.target.value)}
                        placeholder="Email"
                        required
                      />
                      <input
                        type="password"
                        minLength={10}
                        value={authPassword}
                        onChange={(event) => setAuthPassword(event.target.value)}
                        placeholder={t(locale, 'password')}
                        required
                      />
                      {authError && <small className="account-error">{authError}</small>}
                      <button type="submit" disabled={authBusy}>
                        {authBusy
                          ? t(locale, 'updating')
                          : authMode === 'sign-up'
                            ? t(locale, 'createAccount')
                            : t(locale, 'signIn')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode((mode) => (mode === 'sign-in' ? 'sign-up' : 'sign-in'))}
                      >
                        {authMode === 'sign-in' ? t(locale, 'createAccount') : t(locale, 'signIn')}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <div className="workspace">
        <aside className="controls-panel">
          <section className="control-section">
            <h2>{t(locale, 'name')}</h2>
            <label className="text-input">
              <span className="sr-only">Name or text</span>
              <input
                aria-label="Name or text"
                value={params.text}
                maxLength={24}
                onChange={(event) => updateText(event.target.value)}
                placeholder={t(locale, 'namePlaceholder')}
              />
            </label>
          </section>
          <section className="control-section">
            <h2>{t(locale, 'template')}</h2>
            <div className="card-grid template-grid">
              {TEMPLATE_CATALOG.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={`choice-card ${params.templateId === template.id ? 'selected' : ''}`}
                  onClick={() => selectTemplate(template.id)}
                >
                  <span className={`style-swatch template-${template.id}`} />
                  <strong>{templateName(locale, template.id, template.name)}</strong>
                </button>
              ))}
            </div>
          </section>
          {availableStyles.length > 0 && (
            <section className="control-section">
              <h2>{t(locale, 'style')}</h2>
              <div className="card-grid">
                {availableStyles.map((style) => (
                  <button
                    type="button"
                    key={style.id}
                    className={`choice-card ${params.styleId === style.id ? 'selected' : ''}`}
                    onClick={() => update('styleId', style.id)}
                  >
                    <span className={`style-swatch style-${style.id}`} />
                    <strong>{styleName(locale, style.id, style.name)}</strong>
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="control-section">
            <h2>
              {t(locale, 'font')} <span className="selected-note">{selectedFont.name}</span>
            </h2>
            <div className={`font-grid ${params.templateId === 'articulated-name' ? 'articulated-font-grid' : ''}`}>
              {FONT_CATALOG.filter((font) =>
                params.templateId === 'articulated-name'
                  ? fontSupportsArticulatedName(font, params.text)
                  : fontSupportsText(font, params.text),
              ).map((font) => {
                return (
                  <button
                    type="button"
                    key={font.id}
                    className={`font-card font-${font.id} ${params.fontId === font.id ? 'selected' : ''}`}
                    onClick={() => update('fontId', font.id)}
                    title={font.name}
                  >
                    <span>{usesCyrillic ? font.sampleCyrillic : font.sampleLatin}</span>
                    <small>{font.name}</small>
                  </button>
                );
              })}
            </div>
            {fontNotice && (
              <p className="font-notice" aria-live="polite">
                {t(locale, fontNotice.articulated ? 'fontArticulatedFallback' : 'fontFallback', {
                  font: fontNotice.font,
                  replacement: fontNotice.replacement,
                })}
              </p>
            )}
          </section>
          <section className="control-section">
            <h2>{t(locale, 'surface')}</h2>
            <div className="surface-grid">
              {(['matte', 'graph', 'dark', 'wood', 'metal'] as SurfacePresetId[]).map((preset) => (
                <button
                  type="button"
                  key={preset}
                  className={surfacePreset === preset ? 'selected' : ''}
                  onClick={() => setSurfacePreset(preset)}
                >
                  {t(locale, preset)}
                </button>
              ))}
            </div>
          </section>
          <section className="control-section">
            <h2>{t(locale, 'shape')}</h2>
            <div className="range-grid">
              {showsParameter('textHeightMm') && (
                <RangeControl
                  label={t(locale, 'nameHeight')}
                  value={params.textHeightMm}
                  {...PARAMETER_RANGES.textHeightMm}
                  onChange={(value) => update('textHeightMm', value)}
                />
              )}
              {showsParameter('baseThicknessMm') && (
                <RangeControl
                  label={t(locale, 'baseThickness')}
                  value={params.baseThicknessMm}
                  {...(params.templateId === 'articulated-name'
                    ? { ...PARAMETER_RANGES.baseThicknessMm, min: 3.4 }
                    : PARAMETER_RANGES.baseThicknessMm)}
                  onChange={(value) => update('baseThicknessMm', value)}
                />
              )}
              {showsParameter('reliefDepthMm') && (
                <RangeControl
                  label={t(locale, 'raisedText')}
                  value={params.reliefDepthMm}
                  {...PARAMETER_RANGES.reliefDepthMm}
                  onChange={(value) => update('reliefDepthMm', value)}
                />
              )}
              {showsParameter('paddingMm') && (
                <RangeControl
                  label={t(locale, 'borderPadding')}
                  value={params.paddingMm}
                  {...PARAMETER_RANGES.paddingMm}
                  onChange={(value) => update('paddingMm', value)}
                />
              )}
              {showsParameter('letterSpacingMm') && (
                <RangeControl
                  label={t(locale, 'letterSpacing')}
                  value={params.letterSpacingMm}
                  {...PARAMETER_RANGES.letterSpacingMm}
                  onChange={(value) => update('letterSpacingMm', value)}
                />
              )}
              {showsParameter('holeDiameterMm') && (
                <RangeControl
                  label={t(locale, 'keyringHole')}
                  value={params.holeDiameterMm}
                  {...PARAMETER_RANGES.holeDiameterMm}
                  onChange={(value) => update('holeDiameterMm', value)}
                />
              )}
              {params.templateId === 'articulated-name' && (
                <>
                  <RangeControl
                    label={t(locale, 'connectorWidth')}
                    value={params.connectorWidthMm}
                    {...PARAMETER_RANGES.connectorWidthMm}
                    onChange={(value) => update('connectorWidthMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'jointClearance')}
                    value={params.jointClearanceMm}
                    {...PARAMETER_RANGES.jointClearanceMm}
                    onChange={(value) => update('jointClearanceMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'mechanicalGap')}
                    value={params.mechanicalGapMm}
                    {...PARAMETER_RANGES.mechanicalGapMm}
                    onChange={(value) => update('mechanicalGapMm', value)}
                  />
                  <RangeControl
                    label={t(locale, 'maxJointAngle')}
                    value={params.maxJointAngleDeg}
                    {...PARAMETER_RANGES.maxJointAngleDeg}
                    onChange={(value) => update('maxJointAngleDeg', value)}
                  />
                </>
              )}
              {showsParameter('cornerRadiusMm') && (
                <RangeControl
                  label={t(locale, 'cornerRadius')}
                  value={params.cornerRadiusMm}
                  {...PARAMETER_RANGES.cornerRadiusMm}
                  onChange={(value) => update('cornerRadiusMm', value)}
                />
              )}
              {showsParameter('stakeLengthMm') && (
                <RangeControl
                  label={t(locale, 'stakeLength')}
                  value={params.stakeLengthMm}
                  {...PARAMETER_RANGES.stakeLengthMm}
                  onChange={(value) => update('stakeLengthMm', value)}
                />
              )}
            </div>
          </section>
          <div className="controls-scroll-spacer" aria-hidden="true" />
        </aside>
        <section className="preview-panel">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">{t(locale, 'livePreview')}</p>
              <h2>{params.text || t(locale, 'title')}</h2>
            </div>
            <span className={`status-pill ${statusClass}`}>{statusText}</span>
          </div>
          <div className="viewer-wrap">
            <Viewer result={result} surfacePreset={surfacePreset} locale={locale} />
            {!result && <div className="viewer-loading">{t(locale, 'updating')}</div>}
          </div>
          <div className="preview-footer">
            <div className="dimensions">
              {result && result.dimensions.widthMm > 0 ? (
                <>
                  <span>
                    {result.dimensions.widthMm.toFixed(0)} × {result.dimensions.heightMm.toFixed(0)} mm
                  </span>
                  <small>{result.dimensions.thicknessMm.toFixed(1)} mm total thickness</small>
                </>
              ) : (
                <span>{t(locale, 'dimensionsPending')}</span>
              )}
            </div>
            {feedback && (
              <div className="feedback" aria-live="polite">
                {feedback}
              </div>
            )}
          </div>
        </section>
      </div>
      {exportOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setExportOpen(false);
          }}
        >
          <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
            <div className="export-modal-heading">
              <div>
                <p className="eyebrow">{t(locale, 'export')}</p>
                <h2 id="export-title">{t(locale, 'exportTitle')}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setExportOpen(false)}
                aria-label={t(locale, 'close')}
                autoFocus
              >
                ×
              </button>
            </div>
            <p className="export-modal-copy">{t(locale, 'exportDescription')}</p>
            <div className="export-choice-grid">
              <button
                type="button"
                disabled={!result?.printable || downloading}
                onClick={() => {
                  setExportOpen(false);
                  void download('stl');
                }}
              >
                <strong>{t(locale, 'exportStl')}</strong>
                <small>{t(locale, 'exportStlDescription')}</small>
              </button>
              <button
                type="button"
                disabled={!result?.printable || downloading}
                onClick={() => {
                  setExportOpen(false);
                  void download('3mf', 'separate-colors');
                }}
              >
                <strong>{t(locale, 'export3mfSeparate')}</strong>
                <small>{t(locale, 'export3mfSeparateDescription')}</small>
              </button>
              <button
                type="button"
                disabled={!result?.printable || downloading}
                onClick={() => {
                  setExportOpen(false);
                  void download('3mf', 'merged');
                }}
              >
                <strong>{t(locale, 'export3mfMerged')}</strong>
                <small>{t(locale, 'export3mfMergedDescription')}</small>
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
