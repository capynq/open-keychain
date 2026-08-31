import { useCallback, useEffect, useState } from 'react';
import type { KeychainParams, PrintAppearanceOverrides } from '../../entities/keychain';
import { t, type Locale } from '../../infrastructure/i18n';
import { copyTextToClipboard } from '../../shared/lib';
import { buildShareUrl } from './model/share-url';

export type ShareDesignStatus = 'idle' | 'copied' | 'manual' | 'failed';

type UseShareDesignOptions = {
  locale: Locale;
  params: KeychainParams;
  appearanceOverrides: PrintAppearanceOverrides;
  hasNonBundledFont: boolean;
};

type ShareDesignResult = {
  shareDesign: () => Promise<void>;
  shareStatus: ShareDesignStatus;
  shareFontFallback: boolean;
};

const SHARE_STATUS_DURATION_MS = 4_000;

export const useShareDesign = ({
  locale,
  params,
  appearanceOverrides,
  hasNonBundledFont,
}: UseShareDesignOptions): ShareDesignResult => {
  const [shareStatus, setShareStatus] = useState<ShareDesignStatus>('idle');
  const [shareFontFallback, setShareFontFallback] = useState(false);

  useEffect(() => {
    if (shareStatus === 'idle' && !shareFontFallback) return undefined;

    const timeout = window.setTimeout(() => {
      setShareStatus('idle');
      setShareFontFallback(false);
    }, SHARE_STATUS_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [shareFontFallback, shareStatus]);

  const shareDesign = useCallback(async (): Promise<void> => {
    try {
      const value = buildShareUrl(window.location.href, params, appearanceOverrides);

      setShareFontFallback(hasNonBundledFont);
      if (await copyTextToClipboard(value)) {
        setShareStatus('copied');

        return;
      }

      if (window.prompt(t(locale, 'shareManualPrompt'), value) !== null) {
        setShareStatus('manual');
      } else {
        setShareStatus('failed');
      }
    } catch {
      setShareStatus('failed');
    }
  }, [appearanceOverrides, hasNonBundledFont, locale, params]);

  return { shareDesign, shareStatus, shareFontFallback };
};
