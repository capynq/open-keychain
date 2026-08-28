import { hostedMode } from '../../features/hosted/config';
import type { HostedAccountState } from '../../features/hosted';
import type { KeychainParams } from '../../domain/keychain';
import { Link } from 'react-router';
import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';
import { BrandMark } from './BrandMark';
import { LanguagePicker } from './LanguagePicker';
import { PROFILE_ROUTE } from '../routes';
import { Download, Share2, Shuffle, Undo2 } from 'lucide-react';
import { IconButton } from './IconButton';

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
  <header className="topbar customizer-topbar">
    <BrandMark />
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
