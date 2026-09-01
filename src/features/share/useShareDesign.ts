import { useCallback, useEffect, useState } from 'react';
import type { KeychainParams, PrintAppearanceOverrides } from '../../entities/keychain';
import { copyTextToClipboard } from '../../shared/lib';
import { buildShareUrl } from './model/share-url';

export type ShareDesignStatus = 'idle' | 'copied' | 'manual' | 'failed';

type UseShareDesignOptions = {
  params: KeychainParams;
  appearanceOverrides: PrintAppearanceOverrides;
  hasNonBundledFont: boolean;
};

type ShareDesignResult = {
  shareDesign: () => Promise<void>;
  shareStatus: ShareDesignStatus;
  shareFontFallback: boolean;
  shareUrl?: string;
};

const SHARE_STATUS_DURATION_MS = 4_000;
const SHARE_MANUAL_STATUS_DURATION_MS = 15_000;

export const useShareDesign = ({
  params,
  appearanceOverrides,
  hasNonBundledFont,
}: UseShareDesignOptions): ShareDesignResult => {
  const [shareStatus, setShareStatus] = useState<ShareDesignStatus>('idle');
  const [shareFontFallback, setShareFontFallback] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>();

  useEffect(() => {
    if (shareStatus === 'idle' && !shareFontFallback) return undefined;

    const timeout = window.setTimeout(
      () => {
        setShareStatus('idle');
        setShareFontFallback(false);
        setShareUrl(undefined);
      },
      shareStatus === 'manual' ? SHARE_MANUAL_STATUS_DURATION_MS : SHARE_STATUS_DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [shareFontFallback, shareStatus]);

  const shareDesign = useCallback(async (): Promise<void> => {
    try {
      const value = buildShareUrl(window.location.href, params, appearanceOverrides);

      setShareFontFallback(hasNonBundledFont);
      if (await copyTextToClipboard(value)) {
        setShareUrl(undefined);
        setShareStatus('copied');

        return;
      }

      setShareUrl(value);
      setShareStatus('manual');
    } catch {
      setShareUrl(undefined);
      setShareStatus('failed');
    }
  }, [appearanceOverrides, hasNonBundledFont, params]);

  return { shareDesign, shareStatus, shareFontFallback, shareUrl };
};
