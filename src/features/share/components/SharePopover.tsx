import type { CSSProperties } from 'react';
import type { SimpleIcon } from 'simple-icons';

import { Copy, Share2 } from 'lucide-react';
import { useState, type ComponentPropsWithRef, type ReactElement } from 'react';
import { siFacebook, siTelegram, siWhatsapp, siX } from 'simple-icons';

import { AnchoredPopover } from '@/shared/ui/AnchoredPopover';
import { IconButton } from '@/shared/ui/IconButton';
import { NotificationToast } from '@/shared/ui/NotificationToast';
import { PopoverAction } from '@/shared/ui/PopoverAction';

import type { Locale } from '../../../infrastructure/i18n/config';
import type { ShareDesignApi } from '../useShareDesign';

import { t } from '../../../infrastructure/i18n/utils';
import { shareNetworkUrl, type ShareNetwork } from '../model/share-links';
import { ShareFeedback } from './ShareFeedback';
import styles from './SharePopover.module.css';
import { SocialBrandIcon } from './SocialBrandIcon';

type SharePopoverProps = {
  locale: Locale;
  share: ShareDesignApi;
  fontFallback?: boolean;
  disabled?: boolean;
};

const SOCIAL_ACTIONS: readonly {
  network: ShareNetwork;
  brand: SimpleIcon;
  label: string;
}[] = [
  { network: 'telegram', brand: siTelegram, label: 'Telegram' },
  { network: 'whatsapp', brand: siWhatsapp, label: 'WhatsApp' },
  { network: 'facebook', brand: siFacebook, label: 'Facebook' },
  { network: 'x', brand: siX, label: 'X' },
];

export const SharePopover = ({
  locale,
  share,
  fontFallback = false,
  disabled = false,
}: SharePopoverProps): ReactElement => {
  const [open, setOpen] = useState(false);
  const feedback = share.feedback;

  const copyLink = async (): Promise<void> => {
    if (await share.copyLink()) setOpen(false);
  };

  const shareViaDevice = async (): Promise<void> => {
    if (await share.shareViaDevice()) setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (nextOpen && (feedback.status === 'copied' || feedback.status === 'native-completed')) {
      share.clearFeedback();
    }

    setOpen(nextOpen);
  };

  const trigger = (props: ComponentPropsWithRef<'button'>): ReactElement => (
    <IconButton
      {...props}
      action="share"
      className={`share-header-button${open ? ' active' : ''}`}
      icon={Share2}
      iconSize={22}
      label={t(locale, 'share')}
      motion="nudge"
      aria-haspopup="dialog"
      aria-expanded={open}
      disabled={disabled}
    />
  );

  return (
    <>
      <AnchoredPopover
        open={open}
        onOpenChange={handleOpenChange}
        label={t(locale, 'share')}
        placement="bottom-end"
        sizing="content"
        trigger={trigger}
      >
        <div className={styles.root} aria-busy={feedback.status === 'preparing'}>
          <div className={styles.actions}>
            <PopoverAction
              kind="button"
              icon={Copy}
              label={t(locale, 'copyLink')}
              onClick={() => void copyLink()}
              disabled={disabled || feedback.status === 'preparing'}
            />
            {share.canShareViaDevice && (
              <PopoverAction
                kind="button"
                icon={Share2}
                label={t(locale, 'shareViaDevice')}
                onClick={() => void shareViaDevice()}
                disabled={disabled || feedback.status === 'preparing'}
              />
            )}
            {SOCIAL_ACTIONS.map(({ network, brand, label }) => {
              const brandStyle: CSSProperties & { '--popover-action-icon': string } = {
                '--popover-action-icon': `#${brand.hex}`,
              };

              return (
                <PopoverAction
                  key={network}
                  kind="link"
                  leading={<SocialBrandIcon icon={brand} />}
                  label={label}
                  style={brandStyle}
                  href={shareNetworkUrl(network, share.shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                />
              );
            })}
          </div>
          <ShareFeedback
            locale={locale}
            share={share}
            fontFallback={fontFallback}
            disabled={disabled}
            onCopy={() => void copyLink()}
            onNative={() => void shareViaDevice()}
          />
        </div>
      </AnchoredPopover>
      {feedback.status === 'copied' && (
        <NotificationToast
          title={t(locale, 'shareCopied')}
          description={t(locale, 'shareCopiedDescription')}
          dismissLabel={t(locale, 'close')}
          onDismiss={share.clearFeedback}
        />
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {feedback.status === 'native-completed' ? t(locale, 'shareCompleted') : ''}
      </p>
    </>
  );
};
