import { RotateCcw } from 'lucide-react';

import { IconButton } from './IconButton';
import styles from './ResetIconButton.module.css';

export type ResetIconButtonProps = {
  label: string;
  onClick: () => void;
};

export const ResetIconButton = ({ label, onClick }: ResetIconButtonProps) => (
  <IconButton
    action="reset"
    className={`${styles.root} reset-icon-button`}
    icon={RotateCcw}
    label={label}
    onClick={onClick}
  />
);
