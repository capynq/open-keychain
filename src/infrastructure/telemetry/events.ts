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
  | 'customizer_guide_dismissed';

export type AnalyticsProperties = Record<string, string | number | boolean | undefined>;

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;

export const sanitizeProperties = (
  properties: AnalyticsProperties = {},
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(properties).filter(
      ([key, value]) => SAFE_KEY.test(key) && value !== undefined && value !== null,
    ),
  ) as Record<string, string | number | boolean>;
