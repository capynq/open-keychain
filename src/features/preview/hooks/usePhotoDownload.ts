import { useCallback, useEffect, useRef, useState } from 'react';

import type { PhotoCaptureApi } from '../model/photo-capture';

import { photoFilename, type PhotoDesign } from '../model/photo-filename';
import { PHOTO_FORMAT_MIME, type PhotoFormat } from '../model/photo-format';
import { isPhotoResolutionSupported, type PhotoResolution } from '../model/photo-resolution';

export type PhotoDownloadState =
  | { status: 'idle' }
  | { status: 'preparing'; resolution: PhotoResolution; format: PhotoFormat }
  | { status: 'success'; resolution: PhotoResolution; format: PhotoFormat }
  | { status: 'error'; resolution: PhotoResolution; format: PhotoFormat };

const cleanupURL = (url: string): void => {
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const usePhotoDownload = ({
  captureApi,
  design,
  disabled = false,
}: {
  captureApi?: PhotoCaptureApi;
  design?: PhotoDesign;
  disabled?: boolean;
}): {
  state: PhotoDownloadState;
  download: (resolution: PhotoResolution, format?: PhotoFormat) => Promise<boolean>;
} => {
  const [state, setState] = useState<PhotoDownloadState>({ status: 'idle' });
  const activeRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const download = useCallback(
    async (resolution: PhotoResolution, format: PhotoFormat = 'png'): Promise<boolean> => {
      if (
        !captureApi ||
        disabled ||
        activeRef.current ||
        !isPhotoResolutionSupported(resolution, captureApi.maxTextureSize)
      )
        return false;
      const filename = photoFilename(design, resolution, format);
      activeRef.current = true;
      if (mountedRef.current) setState({ status: 'preparing', resolution, format });

      try {
        const blob = await captureApi.capture(resolution, format);
        if (!mountedRef.current) return false;
        if (blob.type !== PHOTO_FORMAT_MIME[format]) {
          throw new Error('The image format did not match the selected format.');
        }
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.append(link);
          try {
            link.click();
          } finally {
            link.remove();
          }
        } finally {
          cleanupURL(url);
        }
        if (mountedRef.current) setState({ status: 'success', resolution, format });
        return true;
      } catch {
        if (mountedRef.current) setState({ status: 'error', resolution, format });
        return false;
      } finally {
        activeRef.current = false;
      }
    },
    [captureApi, design, disabled],
  );

  return { state, download };
};
