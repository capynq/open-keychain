import { RotateCcw } from 'lucide-react';

import { IconButton } from './IconButton';
import styles from './ResetIconButton.module.css';

export type ResetIconButtonProps = {
  label: string;
  onClick: () => void;
  /** Hidden when there is nothing to reset; a same-size placeholder keeps the row steady. */
  visible?: boolean;
};

export const ResetIconButton = ({ label, onClick, visible = true }: ResetIconButtonProps) =>
  visible ? (
    <IconButton
      action="reset"
      className={`${styles.root} reset-icon-button`}
      icon={RotateCcw}
      label={label}
      motion="rotate"
      onClick={onClick}
    />
  ) : (
    <span className="reset-icon-button reset-icon-placeholder" aria-hidden="true" />
  );
