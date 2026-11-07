/** Two-letter specimens on font choices; `font-specimens.ts` holds their generated outlines. */
export const FONT_SPECIMEN_TEXT = { latin: 'Aa', cyrillic: 'Аа' } as const;

export type FontSpecimenScript = keyof typeof FONT_SPECIMEN_TEXT;
