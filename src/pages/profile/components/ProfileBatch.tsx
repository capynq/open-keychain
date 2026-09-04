import { useMemo, useState, type SubmitEvent } from 'react';

import type { SellerPreset } from '@/features/hosted/api/hosted-api';

import {
  MAX_BATCH_ROWS,
  runNameKeychainBatch,
  type BatchRowError,
} from '@/features/hosted/model/name-keychain-batch';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import { useAnalytics } from '../../../infrastructure/telemetry/useTelemetry';

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

export const ProfileBatch = ({ locale, presets }: { locale: Locale; presets: SellerPreset[] }) => {
  const [presetId, setPresetId] = useState('');
  const [csv, setCsv] = useState('order_id,text,quantity\n');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number }>();
  const [errors, setErrors] = useState<BatchRowError[]>([]);
  const [completed, setCompleted] = useState<number>();
  const { track } = useAnalytics();
  const selectedPresetId = presets.some((item) => item.id === presetId)
    ? presetId
    : (presets[0]?.id ?? '');
  const preset = useMemo(
    () => presets.find((item) => item.id === selectedPresetId),
    [presets, selectedPresetId],
  );

  const runBatch = async (event: SubmitEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!preset || busy) return;

    setBusy(true);
    setCompleted(undefined);
    setErrors([]);
    try {
      track('batch_started', { row_count: csv.split(/\r?\n/).filter(Boolean).length - 1 });
      const result = await runNameKeychainBatch(preset, csv, (done, total) =>
        setProgress({ completed: done, total }),
      );

      downloadArchive(result.archive);
      setCompleted(result.completed);
      setErrors(result.parsed.errors);
      track('batch_completed', { row_count: result.completed });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t(locale, 'batchFailed');

      setErrors([{ line: 0, reason: message }]);
      track('batch_failed', { category: 'generation' });
    } finally {
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
              onChange={(event) => setCsv(event.target.value)}
              aria-describedby="batch-csv-help"
            />
          </label>
          <p id="batch-csv-help">{t(locale, 'batchCsvHelp')}</p>
          <button type="submit" disabled={busy || !preset}>
            {busy
              ? t(locale, 'batchProgress', progress ?? { completed: 0, total: 0 })
              : t(locale, 'batchDownload')}
          </button>
        </form>
      ) : (
        <p>{t(locale, 'batchNeedsPreset')}</p>
      )}
      {completed !== undefined && (
        <p className="profile-success" role="status">
          {t(locale, 'batchComplete', { count: completed })}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="profile-batch-errors" role="alert">
          {errors.slice(0, 5).map((error) => (
            <li key={`${error.line}-${error.reason}`}>
              {error.line > 0 ? t(locale, 'batchLine', { line: error.line }) : ''} {error.reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
