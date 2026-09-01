/** Canonical localized entry point for a new customizer design. */
export const createPath = (locale: string): string => `/create?lang=${encodeURIComponent(locale)}`;

/** Canonical localized entry point for a preselected customizer template. */
export const templateCreatePath = (locale: string, templateId: string): string =>
  `/create?template=${encodeURIComponent(templateId)}&lang=${encodeURIComponent(locale)}`;
