import { Camera, Download } from 'lucide-react';
import { useId, useState } from 'react';

import { AnchoredPopover } from '@/shared/ui/AnchoredPopover';
import { IconButton } from '@/shared/ui/IconButton';
import { PopoverAction } from '@/shared/ui/PopoverAction';
import { RecoveryNotice } from '@/shared/ui/RecoveryNotice';

import type { PhotoCaptureApi } from '../../../features/preview/model/photo-capture';
import type { PhotoDesign } from '../../../features/preview/model/photo-filename';
import type { Locale } from '../../../infrastructure/i18n/config';

import { usePhotoDownload } from '../../../features/preview/hooks/usePhotoDownload';
import { PHOTO_FORMATS, type PhotoFormat } from '../../../features/preview/model/photo-format';
import {
  isPhotoResolutionSupported,
  PHOTO_RESOLUTIONS,
} from '../../../features/preview/model/photo-resolution';
import { recoveryMessage, recoverySteps, t } from '../../../infrastructure/i18n/utils';
import './PreviewPhoto.css';

export const PreviewPhoto = ({
  locale,
  captureApi,
  design,
  disabled,
}: {
  locale: Locale;
  captureApi?: PhotoCaptureApi;
  design?: PhotoDesign;
  disabled: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const formatName = useId();
  const [format, setFormat] = useState<PhotoFormat>('png');
  const { state, download } = usePhotoDownload({ captureApi, design, disabled });
  const busy = state.status === 'preparing' ? state.resolution : undefined;

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
  };

  const handleDownload = async (resolution: (typeof PHOTO_RESOLUTIONS)[number]): Promise<void> => {
    const succeeded = await download(resolution, format);
    if (succeeded) {
      setOpen(false);
    }
  };

  const retryResolution = state.status === 'error' ? state.resolution : undefined;
  const smallerResolution = retryResolution
    ? PHOTO_RESOLUTIONS.filter((candidate) => candidate < retryResolution).at(-1)
    : undefined;

  const message =
    state.status === 'error'
      ? t(locale, 'photoCaptureFailed')
      : state.status === 'preparing'
        ? t(locale, 'photoPreparing')
        : state.status === 'success'
          ? t(locale, 'photoDownloaded')
          : '';

  return (
    <>
      <AnchoredPopover
        open={open}
        onOpenChange={handleOpenChange}
        label={t(locale, 'photoResolution')}
        placement="top-end"
        trigger={(props) => (
          <IconButton
            {...props}
            action="preview-photo"
            className={open ? 'active' : undefined}
            icon={Camera}
            label={t(locale, 'photoButton')}
            motion="none"
            disabled={disabled || !captureApi}
          />
        )}
      >
        <div className="preview-photo" aria-busy={busy !== undefined}>
          <fieldset className="photo-format-fieldset" disabled={disabled || busy !== undefined}>
            <legend className="sr-only">{t(locale, 'photoFormat')}</legend>
            <div className="photo-format-options">
              {PHOTO_FORMATS.map((option) => (
                <label className="photo-format-option" key={option}>
                  <input
                    type="radio"
                    name={formatName}
                    value={option}
                    checked={format === option}
                    onChange={() => setFormat(option)}
                  />
                  <span>{option.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div
            className="photo-resolution-choices"
            role="group"
            aria-label={t(locale, 'photoResolution')}
          >
            {PHOTO_RESOLUTIONS.map((resolution) => {
              const supported = isPhotoResolutionSupported(resolution, captureApi?.maxTextureSize);

              return (
                <PopoverAction
                  key={resolution}
                  kind="button"
                  icon={Download}
                  label={t(locale, 'photoPixels', { resolution })}
                  detail={format.toUpperCase()}
                  disabled={disabled || busy !== undefined || !supported}
                  busy={busy === resolution}
                  onClick={() => void handleDownload(resolution)}
                />
              );
            })}
          </div>
          {state.status === 'error' ? (
            <RecoveryNotice
              role="alert"
              message={recoveryMessage(locale, state.failure)}
              detailsLabel={t(locale, 'recoveryDetails')}
              diagnostic={state.failure.message}
              steps={recoverySteps(locale, state.failure)}
              actions={[
                {
                  id: 'retry-photo',
                  label: t(locale, 'recoveryRetry'),
                  onAction: () => handleDownload(state.resolution),
                },
                ...(smallerResolution
                  ? [
                      {
                        id: 'retry-photo-smaller',
                        label: t(locale, 'photoPixels', { resolution: smallerResolution }),
                        onAction: () => handleDownload(smallerResolution),
                      },
                    ]
                  : []),
              ]}
            />
          ) : (
            <p className="preview-photo-status" role="status" aria-live="polite">
              {state.status === 'preparing' ? message : ''}
            </p>
          )}
        </div>
      </AnchoredPopover>
      <span className="sr-only" role="status" aria-live="polite">
        {state.status === 'success' ? message : ''}
      </span>
    </>
  );
};
