import { RotateCcw } from 'lucide-react';
import { IconButton } from '../app/components/IconButton';

export const ResetIconButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <IconButton
    action="reset"
    className="reset-icon-button"
    icon={RotateCcw}
    label={label}
    onClick={onClick}
  />
);
