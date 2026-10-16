import { RotateCcw } from 'lucide-react';
import { useId } from 'react';

import styles from './ColorControl.module.css';
import { IconButton } from './IconButton';

const normalizeHex = (value: string, fallback: string) => {
  const candidate = value.trim().toUpperCase();

  return /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
};

const relativeLuminance = (hex: string) => {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );

  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
};

const contrastText = (hex: string) => {
  const luminance = relativeLuminance(hex);
  const darkLuminance = 0;
  const whiteContrast = (1.0 + 0.05) / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / (darkLuminance + 0.05);

  return whiteContrast >= darkContrast ? '#FFFFFF' : '#000000';
};

export type ColorControlProps = {
  label: string;
  value: string;
  fallback: string;
  resetLabel: string;
  testId?: string;
  description?: string;
  onChange: (value: string) => void;
  onReset: () => void;
};

export const ColorControl = ({
  label,
  value,
  fallback,
  resetLabel,
  testId,
  description,
  onChange,
  onReset,
}: ColorControlProps) => {
  const id = useId();
  const inputId = `color-control-${id}`;
  const descriptionId = `${inputId}-description`;
  const hex = normalizeHex(value, normalizeHex(fallback, '#B84838'));

  return (
    <div className={styles.root} data-testid={testId}>
      <div className={styles.labelRow}>
        <label htmlFor={inputId}>{label}</label>
        <IconButton
          action="reset"
          className={styles.reset}
          icon={RotateCcw}
          label={resetLabel}
          motion="rotate"
          onClick={onReset}
        />
      </div>
      <span id={descriptionId} className="sr-only">
        {description ?? label}
      </span>
      <div className={styles.swatch} style={{ backgroundColor: hex, color: contrastText(hex) }}>
        <strong aria-hidden="true">{hex}</strong>
        <input
          id={inputId}
          type="color"
          value={hex}
          aria-label={label}
          aria-describedby={descriptionId}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
};
