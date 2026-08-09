import { useEffect, useMemo, useRef, useState } from 'react';
import { FONT_CATALOG, fontDefinition, fontSupportsText, textUsesCyrillic } from './fonts/catalog';
import { GeometryClient } from './geometry/client';
import { DEFAULT_PARAMS, normalizeParams, type ExportFormat, type GeometryResult, type KeychainParams, type ThreeMfMode } from './geometry/types';
import { STYLE_CATALOG } from './geometry/styles';
import { detectLocale, issueMessage, styleName, t, type Locale } from './i18n/utils';
import { Viewer, type SurfacePresetId } from './viewer/Viewer';
import './app.css';

function RangeControl({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return <label className="range-control"><span className="control-label"><span>{label}</span><span>{value.toFixed(1)} {unit}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label={label} /></label>;
}

function App() {
  const clientRef = useRef<GeometryClient | undefined>(undefined);
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>(() => (localStorage.getItem('open-keychain-surface') as SurfacePresetId) || 'matte');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('stl');
  const [threeMfMode, setThreeMfMode] = useState<ThreeMfMode>('separate-colors');
  const [params, setParams] = useState<KeychainParams>(() => {
    try {
      const saved = localStorage.getItem('open-keychain-preferences');
      const next = saved ? normalizeParams({ ...DEFAULT_PARAMS, ...JSON.parse(saved) }) : DEFAULT_PARAMS;
      if (!fontSupportsText(fontDefinition(next.fontId), next.text)) next.fontId = FONT_CATALOG.find((font) => fontSupportsText(font, next.text))?.id ?? DEFAULT_PARAMS.fontId;
      return next;
    } catch { return DEFAULT_PARAMS; }
  });
  const [result, setResult] = useState<GeometryResult>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const [fontNotice, setFontNotice] = useState<{ font: string; replacement: string }>();
  const selectedFont = useMemo(() => FONT_CATALOG.find((font) => font.id === params.fontId) ?? FONT_CATALOG[0], [params.fontId]);
  const usesCyrillic = textUsesCyrillic(params.text);

  useEffect(() => { localStorage.setItem('open-keychain-locale', locale); }, [locale]);
  useEffect(() => { localStorage.setItem('open-keychain-surface', surfacePreset); }, [surfacePreset]);
  useEffect(() => {
    const client = new GeometryClient();
    clientRef.current = client;
    return () => client.dispose();
  }, []);
  useEffect(() => {
    localStorage.setItem('open-keychain-preferences', JSON.stringify({ fontId: params.fontId, styleId: params.styleId, textHeightMm: params.textHeightMm, baseThicknessMm: params.baseThicknessMm, reliefDepthMm: params.reliefDepthMm, paddingMm: params.paddingMm, holeDiameterMm: params.holeDiameterMm }));
    const timer = window.setTimeout(() => {
      setBusy(true); setError(undefined);
      clientRef.current?.request(params).then((next) => { setResult(next); setBusy(false); }).catch((cause: Error) => { setBusy(false); setError(cause.message); });
    }, result ? 90 : 0);
    return () => window.clearTimeout(timer);
  }, [params]);

  const update = <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => { setFontNotice(undefined); setParams((current) => ({ ...current, [key]: value })); };
  const updateText = (text: string) => {
    const currentFont = fontDefinition(params.fontId);
    const replacement = !fontSupportsText(currentFont, text) ? FONT_CATALOG.find((font) => fontSupportsText(font, text)) : undefined;
    if (replacement) setFontNotice({ font: currentFont.name, replacement: replacement.name });
    setParams((current) => ({ ...current, text, fontId: !fontSupportsText(fontDefinition(current.fontId), text) ? (replacement?.id ?? current.fontId) : current.fontId }));
  };
  const errorIssue = result?.issues.find((item) => item.severity === 'error');
  const warningIssue = result?.issues.find((item) => item.severity === 'warning');
  const needsAttention = Boolean(error || (!busy && result && (!result.printable || errorIssue)));
  const statusClass = busy ? 'updating' : needsAttention ? 'attention' : warningIssue ? 'adjusted' : 'ready';
  const statusText = busy ? t(locale, 'updating') : needsAttention ? t(locale, 'needsAttention') : warningIssue ? t(locale, 'adjusted') : t(locale, 'ready');
  const download = async () => {
    if (!result?.printable || downloading) return;
    setDownloading(true);
    try {
      const file = await clientRef.current?.export(params, exportFormat, threeMfMode);
      if (!file) return;
      const url = URL.createObjectURL(new Blob([file.data], { type: file.mimeType }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The file could not be created.'); }
    finally { setDownloading(false); }
  };
  const feedback = error ?? (errorIssue ? issueMessage(locale, errorIssue) : warningIssue ? issueMessage(locale, warningIssue) : !busy && result && !result.printable ? t(locale, 'errorNotReady') : busy ? t(locale, 'updating') : t(locale, 'previewFeedback'));

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand-mark"><span>OK</span><div><strong>Open Keychain</strong><small>{t(locale, 'brandTagline')}</small></div></div>
      <div className="topbar-actions"><label className="language-picker"><span className="sr-only">{t(locale, 'language')}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">EN</option><option value="ru">RU</option><option value="uk">UK</option></select></label><a href="https://github.com/WilfredoN/3d-keychain" className="github-link">{t(locale, 'openSource')}</a></div>
    </header>
    <div className="workspace">
      <aside className="controls-panel">
        <div className="intro"><p className="eyebrow">{t(locale, 'eyebrow')}</p><h1>{t(locale, 'title')}</h1><p>{t(locale, 'intro')}</p></div>
        <section className="control-section"><h2>{t(locale, 'name')}</h2><label className="text-input"><span className="sr-only">Name or text</span><input aria-label="Name or text" value={params.text} maxLength={24} onChange={(event) => updateText(event.target.value)} placeholder={t(locale, 'namePlaceholder')} /></label><p className="hint">{t(locale, 'nameHint')}</p></section>
        <section className="control-section"><h2>{t(locale, 'style')}</h2><div className="card-grid">{STYLE_CATALOG.map((style) => <button type="button" key={style.id} className={`choice-card ${params.styleId === style.id ? 'selected' : ''}`} onClick={() => update('styleId', style.id)}><span className={`style-swatch style-${style.id}`} /><strong>{styleName(locale, style.id, style.name)}</strong></button>)}</div></section>
        <section className="control-section"><h2>{t(locale, 'font')} <span className="selected-note">{selectedFont.name}</span></h2><div className="font-grid">{FONT_CATALOG.map((font) => { const compatible = fontSupportsText(font, params.text); return <button type="button" key={font.id} className={`font-card font-${font.id} ${params.fontId === font.id ? 'selected' : ''}`} onClick={() => update('fontId', font.id)} disabled={!compatible} aria-disabled={!compatible} title={compatible ? font.name : t(locale, 'fontMissingCyrillic', { font: font.name })}><span>{usesCyrillic ? font.sampleCyrillic : font.sampleLatin}</span><small>{font.name}</small></button>; })}</div>{fontNotice && <p className="font-notice" aria-live="polite">{t(locale, 'fontFallback', fontNotice)}</p>}</section>
        <section className="control-section"><h2>{t(locale, 'surface')}</h2><div className="surface-grid">{(['matte', 'graph', 'dark'] as SurfacePresetId[]).map((preset) => <button type="button" key={preset} className={surfacePreset === preset ? 'selected' : ''} onClick={() => setSurfacePreset(preset)}>{t(locale, preset)}</button>)}</div></section>
        <section className="control-section"><h2>{t(locale, 'shape')}</h2><div className="range-grid"><RangeControl label={t(locale, 'nameHeight')} value={params.textHeightMm} min={12} max={30} step={0.5} unit="mm" onChange={(value) => update('textHeightMm', value)} /><RangeControl label={t(locale, 'baseThickness')} value={params.baseThicknessMm} min={1.6} max={4} step={0.1} unit="mm" onChange={(value) => update('baseThicknessMm', value)} /><RangeControl label={t(locale, 'raisedText')} value={params.reliefDepthMm} min={0.6} max={2} step={0.1} unit="mm" onChange={(value) => update('reliefDepthMm', value)} /><RangeControl label={t(locale, 'borderPadding')} value={params.paddingMm} min={1.2} max={5} step={0.1} unit="mm" onChange={(value) => update('paddingMm', value)} /><RangeControl label={t(locale, 'keyringHole')} value={params.holeDiameterMm} min={3} max={7} step={0.1} unit="mm" onChange={(value) => update('holeDiameterMm', value)} /></div></section>
      </aside>
      <section className="preview-panel"><div className="preview-heading"><div><p className="eyebrow">LIVE PREVIEW</p><h2>{params.text || t(locale, 'title')}</h2></div><span className={`status-pill ${statusClass}`}>{statusText}</span></div><div className="viewer-wrap"><Viewer result={result} surfacePreset={surfacePreset} locale={locale} />{!result && <div className="viewer-loading">{t(locale, 'updating')}</div>}</div><div className="preview-footer"><div className="dimensions">{result && result.dimensions.widthMm > 0 ? <><span>{result.dimensions.widthMm.toFixed(0)} × {result.dimensions.heightMm.toFixed(0)} mm</span><small>{result.dimensions.thicknessMm.toFixed(1)} mm total thickness</small></> : <span>{t(locale, 'dimensionsPending')}</span>}</div><div className="feedback" aria-live="polite">{feedback}</div></div></section>
    </div>
    <footer className="download-bar"><div><strong>{t(locale, 'downloadReady')}</strong><span>{exportFormat === 'stl' ? 'STL · millimetres' : `${t(locale, 'download3mf')} · ${threeMfMode === 'merged' ? t(locale, 'merged') : t(locale, 'separateColors')}`}</span></div><div className="export-options"><button type="button" className={exportFormat === 'stl' ? 'selected' : ''} onClick={() => setExportFormat('stl')}>STL</button><button type="button" className={exportFormat === '3mf' ? 'selected' : ''} onClick={() => setExportFormat('3mf')}>3MF</button>{exportFormat === '3mf' && <select value={threeMfMode} aria-label={t(locale, 'exportMode')} onChange={(event) => setThreeMfMode(event.target.value as ThreeMfMode)}><option value="separate-colors">{t(locale, 'separateColors')}</option><option value="merged">{t(locale, 'merged')}</option></select>}</div><button className="download-button" disabled={!result?.printable || downloading} onClick={download}>{downloading ? t(locale, 'preparing') : exportFormat === 'stl' ? t(locale, 'downloadStl') : t(locale, 'download3mf')}</button></footer>
  </main>;
}

export default App;
