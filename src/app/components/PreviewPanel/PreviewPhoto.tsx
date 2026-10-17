import { Download } from 'lucide-react';
import { useRef, useState } from 'react';

import type { PhotoCaptureApi } from '../../../features/preview/model/photo-capture';
import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import './PreviewPhoto.css';

const RESOLUTIONS = [1024, 2048, 4096] as const;

export const PreviewPhoto = ({
  locale,
  captureApi,
  disabled,
  open,
  choicesId,
}: {
  locale: Locale;
  captureApi?: PhotoCaptureApi;
  disabled: boolean;
  open: boolean;
  choicesId: string;
}) => {
  const [busy, setBusy] = useState<number>();
  const [message, setMessage] = useState<'photoDownloaded' | 'photoCaptureFailed'>();
  const capturing = useRef(false);

  const download = async (resolution: number): Promise<void> => {
    if (!captureApi || disabled || capturing.current) return;
    capturing.current = true;
    setBusy(resolution);
    setMessage(undefined);
    try {
      const blob = await captureApi.capture(resolution);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `keychain-photo-${resolution}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('photoDownloaded');
    } catch {
      setMessage('photoCaptureFailed');
    } finally {
      capturing.current = false;
      setBusy(undefined);
    }
  };

  if (!open) return null;

  return (
    <div className="preview-photo">
      <div
        id={choicesId}
        className="photo-resolution-choices"
        role="group"
        aria-label={t(locale, 'photoResolution')}
        aria-busy={busy !== undefined}
      >
        {RESOLUTIONS.map((resolution) => (
          <button
            key={resolution}
            type="button"
            className="photo-resolution-card"
            disabled={
              disabled ||
              busy !== undefined ||
              !captureApi ||
              resolution > captureApi.maxTextureSize
            }
            onClick={() => void download(resolution)}
          >
            <Download aria-hidden="true" />
            <strong>{t(locale, 'photoPixels', { resolution })}</strong>
            <span>PNG</span>
            {busy === resolution && <small>{t(locale, 'photoPreparing')}</small>}
          </button>
        ))}
      </div>
      <p className="preview-photo-status" role="status" aria-live="polite">
        {message ? t(locale, message) : ''}
      </p>
    </div>
  );
};
