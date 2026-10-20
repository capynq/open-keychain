import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { KeychainParams, PrintAppearanceOverrides } from '../../domain/keychain/model/types';
import type { RecoveryFailure } from '../../shared/lib/recovery/failure';

import { copyTextToClipboard } from '../../shared/lib/clipboard';
import { failureFrom } from '../../shared/lib/recovery/failure';
import { buildShareUrl } from './model/share-url';

export type ShareDesignFeedback =
  | { status: 'idle' }
  | { status: 'preparing'; url: string }
  | { status: 'copied'; url: string }
  | { status: 'manual'; url: string }
  | { status: 'failed'; url: string; failure: RecoveryFailure }
  | { status: 'native-completed'; url: string }
  | { status: 'native-failed'; url: string; failure: RecoveryFailure };

export type ShareDesignStatus = ShareDesignFeedback['status'];

type UseShareDesignOptions = {
  params: KeychainParams;
  appearanceOverrides: PrintAppearanceOverrides;
  hasNonBundledFont: boolean;
};

export type ShareDesignApi = {
  feedback: ShareDesignFeedback;
  shareFontFallback: boolean;
  shareUrl: string;
  canShareViaDevice: boolean;
  copyLink: () => Promise<boolean>;
  shareViaDevice: () => Promise<boolean>;
  clearFeedback: () => void;
};

const getShareUrl = (
  params: KeychainParams,
  appearanceOverrides: PrintAppearanceOverrides,
): string => buildShareUrl(window.location.href, params, appearanceOverrides);

const isNativeShareSupported = (url: string): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false;

  if (typeof navigator.canShare !== 'function') return true;

  try {
    return navigator.canShare({ url });
  } catch {
    return false;
  }
};

const shareFailure = (error: unknown, fallbackCode: string): RecoveryFailure =>
  failureFrom(error, fallbackCode);

// The hook owns two guarded async workflows and their shared lifecycle state.

export const useShareDesign = ({
  params,
  appearanceOverrides,
  hasNonBundledFont,
  // eslint-disable-next-line max-lines-per-function
}: UseShareDesignOptions): ShareDesignApi => {
  const [feedback, setFeedback] = useState<ShareDesignFeedback>({ status: 'idle' });
  const [shareFontFallback, setShareFontFallback] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);
  const designSignature = useMemo(
    () => JSON.stringify([params, appearanceOverrides]),
    [appearanceOverrides, params],
  );
  const previousSignature = useRef(designSignature);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  useEffect(() => {
    if (previousSignature.current === designSignature) return;

    previousSignature.current = designSignature;
    requestId.current += 1;
    busy.current = false;
    setFeedback({ status: 'idle' });
    setShareFontFallback(false);
  }, [designSignature]);

  const locationHref = typeof window === 'undefined' ? '' : window.location.href;
  const currentUrl = useMemo(
    () => (locationHref ? buildShareUrl(locationHref, params, appearanceOverrides) : ''),
    [appearanceOverrides, locationHref, params],
  );
  const canShareViaDevice = isNativeShareSupported(currentUrl);

  const copyLink = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false;

    const url = getShareUrl(params, appearanceOverrides);
    const operationId = ++requestId.current;
    busy.current = true;
    setShareFontFallback(hasNonBundledFont);
    setFeedback({ status: 'preparing', url });
    try {
      if (await copyTextToClipboard(url)) {
        if (!mounted.current || operationId !== requestId.current) return false;

        setFeedback({ status: 'copied', url });

        return true;
      }

      if (!mounted.current || operationId !== requestId.current) return false;

      setFeedback({ status: 'manual', url });

      return false;
    } catch (error) {
      if (!mounted.current || operationId !== requestId.current) return false;

      setFeedback({
        status: 'failed',
        url,
        failure: shareFailure(error, 'share-clipboard-failed'),
      });

      return false;
    } finally {
      if (operationId === requestId.current) busy.current = false;
    }
  }, [appearanceOverrides, hasNonBundledFont, params]);

  const shareViaDevice = useCallback(async (): Promise<boolean> => {
    const share = typeof navigator !== 'undefined' ? navigator.share : undefined;

    if (!share) return false;

    if (busy.current) return false;

    const url = getShareUrl(params, appearanceOverrides);
    const operationId = ++requestId.current;
    busy.current = true;
    setShareFontFallback(hasNonBundledFont);

    setFeedback({ status: 'preparing', url });
    // Keep the native call in the click handler so mobile browsers retain user activation.
    let result: Promise<void>;

    try {
      result = share.call(navigator, { url });
    } catch (error) {
      busy.current = false;
      setFeedback({
        status: 'native-failed',
        url,
        failure: shareFailure(error, 'share-native-failed'),
      });

      return false;
    }

    return result.then(
      () => {
        if (!mounted.current || operationId !== requestId.current) return false;

        setFeedback({ status: 'native-completed', url });
        busy.current = false;

        return true;
      },
      (error: unknown) => {
        if (!mounted.current || operationId !== requestId.current) return false;

        if (error instanceof DOMException && error.name === 'AbortError') {
          setFeedback({ status: 'idle' });
          busy.current = false;

          return false;
        }

        setFeedback({
          status: 'native-failed',
          url,
          failure: shareFailure(error, 'share-native-failed'),
        });
        busy.current = false;

        return false;
      },
    );
  }, [appearanceOverrides, hasNonBundledFont, params]);

  const clearFeedback = useCallback((): void => {
    requestId.current += 1;
    busy.current = false;
    setFeedback({ status: 'idle' });
    setShareFontFallback(false);
  }, []);

  return {
    feedback,
    shareFontFallback,
    shareUrl: currentUrl,
    canShareViaDevice,
    copyLink,
    shareViaDevice,
    clearFeedback,
  };
};
