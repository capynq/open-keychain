import type { FontSpecimenScript } from '@/domain/keychain/fonts/font-specimen-text';

import {
  FONT_SPECIMEN_EM,
  FONT_SPECIMEN_SPRITE,
  FONT_SPECIMENS,
} from '@/domain/keychain/fonts/font-specimens';

import styles from './FontSpecimen.module.css';

/**
 * "Aa" drawn from the generated outline sprite instead of the font file, so a page of font
 * choices costs one small cached request. The box matches the text it replaces: the advance
 * width and `lineHeight` em tall, with the baseline where the font's line box puts it.
 */
export const FontSpecimen = ({
  fontId,
  script,
  lineHeight = 1.2,
  className,
}: {
  fontId: string;
  script: FontSpecimenScript;
  lineHeight?: number;
  className?: string;
}) => {
  const metrics = FONT_SPECIMENS[fontId];
  const glyphs = metrics?.[script];
  if (!metrics || !glyphs) return null;
  const height = lineHeight * FONT_SPECIMEN_EM;
  const top = -(metrics.ascent + (height - metrics.ascent - metrics.descent) / 2);
  return (
    <svg
      className={[styles.root, className].filter(Boolean).join(' ')}
      viewBox={`0 ${top} ${glyphs.advance} ${height}`}
      style={{ width: `${glyphs.advance / FONT_SPECIMEN_EM}em`, height: `${lineHeight}em` }}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-font-specimen={glyphs.id}
    >
      <use href={`${FONT_SPECIMEN_SPRITE}#${glyphs.id}`} />
    </svg>
  );
};
