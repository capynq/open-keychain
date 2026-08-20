export type AnalyticsEvent =
  | 'page_view'
  | 'landing_view'
  | 'start_designing'
  | 'language_changed'
  | 'template_selected'
  | 'geometry_ready'
  | 'geometry_error'
  | 'export_started'
  | 'export_completed'
  | 'export_failed'
  | 'surface_preset_changed'
  | 'customizer_guide_step_clicked'
  | 'customizer_guide_dismissed'
  | 'seo_page_view'
  | 'seo_cta_clicked'
  | 'seo_language_changed';

export type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

// Keep this list deliberately small: values sent by either the app or the static
// SEO pages must be coarse product metadata, never form input or URL contents.
const SAFE_PROPERTY_KEYS = new Set([
  'category',
  'count',
  'cta',
  'enabled',
  'format',
  'from',
  'locale',
  'mode',
  'ok',
  'page_id',
  'page_type',
  'path',
  'preset',
  'source',
  'status',
  'step',
  'template',
  'to',
]);

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;

export const sanitizeProperties = (
  properties: AnalyticsProperties = {},
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) =>
        SAFE_KEY.test(key) && SAFE_PROPERTY_KEYS.has(key) && value !== undefined && value !== null,
    ),
  ) as Record<string, string | number | boolean>;
