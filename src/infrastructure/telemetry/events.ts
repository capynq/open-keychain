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
  | 'seo_language_changed'
  | 'preset_saved'
  | 'batch_started'
  | 'batch_completed'
  | 'batch_failed';

export type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

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
  'row_count',
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
