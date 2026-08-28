import { RotateCcw } from 'lucide-react';
import { IconButton } from '../../app/components/IconButton/IconButton';
import styles from './ResetIconButton.module.css';

export const ResetIconButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <IconButton
    action="reset"
    className={`${styles.root} reset-icon-button`}
    icon={RotateCcw}
    label={label}
    onClick={onClick}
  />
);
