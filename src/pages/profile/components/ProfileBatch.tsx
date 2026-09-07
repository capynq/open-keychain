import { useMemo, useRef, useState, type SubmitEvent } from 'react';

import type { SellerPreset } from '@/features/hosted/api/hosted-api';

import {
  BatchGenerationError,
  MAX_BATCH_ROWS,
  parseNameKeychainCsv,
  runNameKeychainBatch,
  type BatchRowError,
  type ExportBatchFormat,
} from '@/features/hosted/model/name-keychain-batch';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import { useAnalytics } from '../../../infrastructure/telemetry/useTelemetry';
import { BatchLaborEstimate } from './BatchLaborEstimate';
import { BatchRowErrors } from './BatchRowErrors';

const downloadArchive = (archive: Uint8Array): void => {
  const archiveBuffer = new ArrayBuffer(archive.byteLength);

  new Uint8Array(archiveBuffer).set(archive);
  const url = URL.createObjectURL(new Blob([archiveBuffer], { type: 'application/zip' }));
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = 'open-keychain-name-keychains.zip';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

// The profile card intentionally keeps the form controls and generated-output status together.
// eslint-disable-next-line max-lines-per-function
export const ProfileBatch = ({ locale, presets }: { locale: Locale; presets: SellerPreset[] }) => {
  const [presetId, setPresetId] = useState('');
  const [csv, setCsv] = useState('order_id,text,quantity,subtitle\n');
  const [format, setFormat] = useState<ExportBatchFormat>('stl');
  const [includeWarnings, setIncludeWarnings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number }>();
  const [errors, setErrors] = useState<BatchRowError[]>([]);
  const [completed, setCompleted] = useState<number>();
  const abortController = useRef<AbortController | null>(null);
  const { track } = useAnalytics();
  const selectedPresetId = presets.some((item) => item.id === presetId)
    ? presetId
    : (presets[0]?.id ?? '');
  const preset = useMemo(
    () => presets.find((item) => item.id === selectedPresetId),
    [presets, selectedPresetId],
  );
  const parsed = useMemo(() => parseNameKeychainCsv(csv), [csv]);
  const runBatch = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!preset || busy) return;

    setBusy(true);
    setCompleted(undefined);
    setErrors(parsed.errors);
    const controller = new AbortController();
    abortController.current = controller;
    try {
      track('batch_started', { row_count: csv.split(/\r?\n/).filter(Boolean).length - 1 });
      const result = await runNameKeychainBatch(
        preset,
        csv,
        (done, total) => setProgress({ completed: done, total }),
        { format, includeWarnings, signal: controller.signal },
      );

      downloadArchive(result.archive);
      setCompleted(result.completed);
      setErrors(result.parsed.errors);
      track('batch_completed', { row_count: result.completed });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        setErrors([]);

        return;
      }

      if (cause instanceof BatchGenerationError) {
        setErrors(cause.parsed.errors);
        track('batch_failed', { category: 'generation' });

        return;
      }

      const message = cause instanceof Error ? cause.message : t(locale, 'batchFailed');

      setErrors([{ line: 0, reason: message }]);
      track('batch_failed', { category: 'generation' });
    } finally {
      abortController.current = null;
      setBusy(false);
      setProgress(undefined);
    }
  };

  return (
    <section className="profile-card profile-batch" aria-labelledby="batch-title">
      <div className="profile-card-heading">
        <h2 id="batch-title">{t(locale, 'batchTitle')}</h2>
        <small>{t(locale, 'batchLimit', { count: MAX_BATCH_ROWS })}</small>
      </div>
      <p>{t(locale, 'batchPrivacy')}</p>
      {presets.length ? (
        <form onSubmit={runBatch}>
          <label>
            {t(locale, 'batchPreset')}
            <select value={selectedPresetId} onChange={(event) => setPresetId(event.target.value)}>
              {presets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t(locale, 'batchCsv')}
            <textarea
              spellCheck={false}
              value={csv}
              onChange={(event) => {
                setCsv(event.target.value);
                setErrors([]);
              }}
              aria-describedby="batch-csv-help"
            />
          </label>
          <p id="batch-csv-help">{t(locale, 'batchCsvHelp')}</p>
          <label>
            {t(locale, 'batchFormat')}
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value as ExportBatchFormat)}
            >
              <option value="stl">{t(locale, 'batchFormatStl')}</option>
              <option value="3mf">{t(locale, 'batchFormat3mf')}</option>
            </select>
          </label>
          <label className="profile-batch-checkbox">
            <input
              type="checkbox"
              checked={includeWarnings}
              onChange={(event) => setIncludeWarnings(event.target.checked)}
            />
            {t(locale, 'batchIncludeWarnings')}
          </label>
          <button type="submit" disabled={busy || !preset}>
            {busy
              ? t(locale, 'batchProgress', progress ?? { completed: 0, total: 0 })
              : t(locale, 'batchDownload')}
          </button>
          {busy && (
            <button type="button" onClick={() => abortController.current?.abort()}>
              {t(locale, 'batchCancel')}
            </button>
          )}
        </form>
      ) : (
        <p>{t(locale, 'batchNeedsPreset')}</p>
      )}
      {completed !== undefined && (
        <p className="profile-success" role="status">
          {t(locale, 'batchComplete', { count: completed })}
        </p>
      )}
      <BatchRowErrors locale={locale} errors={errors.length > 0 ? errors : parsed.errors} />
      <BatchLaborEstimate locale={locale} orderCount={parsed.orders.length} />
    </section>
  );
};
