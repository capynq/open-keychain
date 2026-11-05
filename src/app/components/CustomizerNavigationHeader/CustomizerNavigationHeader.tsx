import type { ReactNode } from 'react';

import { Download, ListChecks, Redo2, Share2, Shuffle, Undo2 } from 'lucide-react';
import { Link } from 'react-router';

import type { KeychainParams } from '../../../domain/keychain/model/types';
import type { UndoKind } from '../../../features/customizer/hooks/useCustomizerParams';
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
  shareAction,
  onSetupOpen,
  setupOpen = false,
  onRandomize,
  onUndo,
  canUndo,
  undoKind,
  onRedo,
  canRedo = false,
  randomizing = false,
  exportDisabled = false,
  exportQueued = false,
  hosted,
  currentParams,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen: boolean;
  onExportOpen?: () => void;
  onShare?: () => void;
  shareAction?: ReactNode;
  onSetupOpen?: () => void;
  setupOpen?: boolean;
  onRandomize?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  undoKind?: UndoKind;
  onRedo?: () => void;
  canRedo?: boolean;
  randomizing?: boolean;
  exportDisabled?: boolean;
  /** Export was requested while the latest edit is still being checked. */
  exportQueued?: boolean;
  hosted?: HostedAccountState;
  currentParams?: KeychainParams;
}) => (
  <header className={`${styles.root} topbar customizer-topbar`}>
    <BrandMark locale={locale} />
    <div className="topbar-export-actions">
      <span className="topbar-export-lead">
        <IconButton
          action="setup"
          className="setup-header-button"
          icon={ListChecks}
          iconSize={20}
          label={t(locale, 'quickSetupReopen')}
          visibleLabel={t(locale, 'quickSetupEyebrow')}
          showLabel
          motion="none"
          onClick={onSetupOpen}
          disabled={randomizing}
          aria-haspopup="dialog"
          aria-expanded={setupOpen}
        />
        <IconButton
          action="randomize"
          className="randomize-header-button"
          icon={Shuffle}
          iconSize={20}
          label={t(locale, randomizing ? 'randomizing' : 'randomize')}
          motion="rotate"
          onClick={onRandomize}
          disabled={randomizing}
          busy={randomizing}
        />
        <span className="topbar-divider" aria-hidden="true" />
      </span>
      <IconButton
        action="export"
        className="export-header-button"
        icon={Download}
        iconSize={22}
        label={t(locale, 'export')}
        showLabel
        motion="nudge"
        onClick={onExportOpen}
        disabled={randomizing || exportDisabled}
        busy={randomizing || exportQueued}
        aria-haspopup="dialog"
        aria-expanded={exportOpen}
      />
      <span className="topbar-export-trail">
        {shareAction ?? (
          <IconButton
            action="share"
            className="share-header-button"
            icon={Share2}
            iconSize={22}
            label={t(locale, 'share')}
            motion="nudge"
            onClick={onShare}
            disabled={randomizing}
          />
        )}
      </span>
    </div>
    <div className="topbar-actions">
      <IconButton
        action="undo"
        className="undo-header-button"
        icon={Undo2}
        iconSize={20}
        label={t(locale, undoKind === 'recovery' ? 'recoveryUndo' : 'undo')}
        motion="rotate"
        onClick={onUndo}
        disabled={randomizing || !canUndo}
      />
      <IconButton
        action="redo"
        className="redo-header-button"
        icon={Redo2}
        iconSize={20}
        label={t(locale, 'redo')}
        motion="rotate"
        onClick={onRedo}
        disabled={randomizing || !canRedo}
      />
      <LanguagePicker locale={locale} onLocaleChange={onLocaleChange} />
      {hostedMode && hosted && (
        <Link className="header-profile-link" to={PROFILE_ROUTE} state={{ currentParams }}>
          {hosted.account ? t(locale, 'profile') : t(locale, 'signIn')}
        </Link>
      )}
    </div>
  </header>
);
