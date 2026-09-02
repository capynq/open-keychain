import { Download, Share2, Shuffle, Undo2 } from 'lucide-react';
import { Link } from 'react-router';

import type { KeychainParams } from '../../../domain/keychain/model/types';
import type { HostedAccountState } from '../../../features/hosted/hooks/useHostedAccount';
import type { Locale } from '../../../infrastructure/i18n/config';

import { hostedMode } from '../../../features/hosted/config';
import { t } from '../../../infrastructure/i18n/utils';
import { PROFILE_ROUTE } from '../../routes';
import { BrandMark } from '../BrandMark/BrandMark';
import { IconButton } from '../IconButton/IconButton';
import { LanguagePicker } from '../LanguagePicker/LanguagePicker';
import styles from './CustomizerNavigationHeader.module.css';

export const CustomizerNavigationHeader = ({
  locale,
  onLocaleChange,
  exportOpen,
  onExportOpen,
  onShare,
  onRandomize,
  onUndo,
  canUndo,
  randomizing = false,
  exportDisabled = false,
  hosted,
  currentParams,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen?: () => void;
  onShare?: () => void;
  onRandomize?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  randomizing?: boolean;
  exportDisabled?: boolean;
  hosted?: HostedAccountState;
  currentParams?: KeychainParams;
}) => (
  <header className={`${styles.root} topbar customizer-topbar`}>
    <BrandMark locale={locale} />
    <div className="topbar-export-actions">
      <IconButton
        action="export"
        className="export-header-button"
        icon={Download}
        label={t(locale, 'export')}
        onClick={onExportOpen}
        disabled={randomizing || exportDisabled}
        busy={randomizing}
        aria-haspopup="dialog"
        aria-expanded={exportOpen}
      />
      <IconButton
        action="share"
        className="share-header-button"
        icon={Share2}
        label={t(locale, 'share')}
        onClick={onShare}
        disabled={randomizing}
      />
    </div>
    <div className="topbar-actions">
      <IconButton
        action="randomize"
        className="randomize-header-button"
        icon={Shuffle}
        label={t(locale, randomizing ? 'randomizing' : 'randomize')}
        onClick={onRandomize}
        disabled={randomizing}
        busy={randomizing}
      />
      {canUndo && (
        <IconButton
          action="undo"
          className="undo-header-button"
          icon={Undo2}
          label={t(locale, 'undo')}
          onClick={onUndo}
          disabled={randomizing}
        />
      )}
      <LanguagePicker locale={locale} onLocaleChange={onLocaleChange} />
      {hostedMode && hosted && (
        <Link className="header-profile-link" to={PROFILE_ROUTE} state={{ currentParams }}>
          {hosted.account ? t(locale, 'profile') : t(locale, 'signIn')}
        </Link>
      )}
    </div>
  </header>
);
