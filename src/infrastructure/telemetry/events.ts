import type { CaptureResult } from 'posthog-js';

import { FONT_CATEGORY_ORDER, FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import { KEYRING_POSITIONS } from '@/domain/keychain/model/keyring-position';
import { KEYRING_PRESETS } from '@/domain/keychain/model/keyring-presets';

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
  | 'customizer_option_changed'
  | 'setup_step_viewed'
  | 'setup_step_completed'
  | 'setup_step_backed_out'
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
  'family',
  'format',
  'from',
  'locale',
  'mode',
  'ok',
  'option_id',
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

const SETUP_STEPS = new Set([
  'name-size',
  'keyring-position',
  'keyring-opening',
  'fonts',
  'colors',
  'review',
]);
const EDGE_FINISH_IDS = new Set(['sharp', 'chamfer', 'round']);

const CUSTOMIZER_OPTION_IDS: Record<string, ReadonlySet<string>> = {
  font: new Set(FONT_CATALOG.filter((font) => font.source === 'bundled').map((font) => font.id)),
  font_category: new Set(FONT_CATEGORY_ORDER),
  keyring_position: new Set(KEYRING_POSITIONS),
  keyring_opening: new Set([...KEYRING_PRESETS.map((preset) => preset.id), 'custom']),
  base_finish: EDGE_FINISH_IDS,
  text_finish: EDGE_FINISH_IDS,
};

const EVENT_PROPERTY_KEYS: Partial<Record<AnalyticsEvent, ReadonlySet<string>>> = {
  customizer_option_changed: new Set(['family', 'option_id']),
  setup_step_viewed: new Set(['step']),
  setup_step_completed: new Set(['step']),
  setup_step_backed_out: new Set(['step']),
};

const SAFE_KEY = /^[a-z][a-z0-9_]*$/;

export const sanitizeProperties = (
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => {
        if (
          !SAFE_KEY.test(key) ||
          !SAFE_PROPERTY_KEYS.has(key) ||
          value === undefined ||
          value === null
        ) {
          return false;
        }

        const eventKeys = EVENT_PROPERTY_KEYS[event];
        if (eventKeys) {
          if (!eventKeys.has(key)) return false;
          if (key === 'step') return typeof value === 'string' && SETUP_STEPS.has(value);
          if (key === 'family')
            return typeof value === 'string' && Object.hasOwn(CUSTOMIZER_OPTION_IDS, value);
          if (key === 'option_id') {
            const family = properties.family;
            return (
              typeof family === 'string' &&
              typeof value === 'string' &&
              Object.hasOwn(CUSTOMIZER_OPTION_IDS, family) &&
              (CUSTOMIZER_OPTION_IDS[family]?.has(value) ?? false)
            );
          }
        }

        return true;
      })
      .map(([key, value]) => [
        key,
        key === 'path' && typeof value === 'string' ? value.split(/[?#]/, 1)[0] : value,
      ]),
  ) as Record<string, string | number | boolean>;

const OMIT_SDK_PROPERTIES = new Set([
  '$initial_campaign_params',
  '$initial_person_info',
  '$initial_referrer_info',
  '$initial_referrer',
  '$initial_referring_domain',
  '$raw_user_agent',
  '$referrer',
  '$referring_domain',
  '$screen_height',
  '$screen_width',
  '$viewport_height',
  '$viewport_width',
]);

const ATTRIBUTION_PROPERTY_KEYS = new Set([
  'referrer',
  'referring_domain',
  'search_engine',
  'search_keyword',
  'ph_keyword',
  'gad_source',
  'mc_cid',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  'igshid',
  'ttclid',
  'rdt_cid',
  'epik',
  'qclid',
  'sccid',
  'irclid',
  '_kx',
]);

const ROUTE_URL_PROPERTIES = new Set([
  '$current_url',
  '$initial_current_url',
  '$session_entry_url',
]);

const routeOnlyUrl = (value: string): string | undefined => {
  try {
    const url = new URL(value, 'https://open-keychain.invalid');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.origin === 'https://open-keychain.invalid'
      ? url.pathname
      : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
};

const isAttributionProperty = (key: string): boolean => {
  const normalizedKey = key.replace(/^\$(?:initial_|session_entry_)?/, '').toLowerCase();
  return normalizedKey.startsWith('utm_') || ATTRIBUTION_PROPERTY_KEYS.has(normalizedKey);
};

const sanitizePostHogProperties = (
  source: CaptureResult['properties'],
): CaptureResult['properties'] => {
  const properties = { ...source };
  for (const [key, value] of Object.entries(properties)) {
    if (OMIT_SDK_PROPERTIES.has(key) || key.startsWith('$geoip_') || isAttributionProperty(key)) {
      delete properties[key];
      continue;
    }

    if (ROUTE_URL_PROPERTIES.has(key)) {
      const route = typeof value === 'string' ? routeOnlyUrl(value) : undefined;
      if (route) properties[key] = route;
      else delete properties[key];
    } else if (key === 'path' && typeof value === 'string') {
      properties[key] = value.split(/[?#]/, 1)[0];
    }
  }
  return properties;
};

/** Keep the route needed for analysis while removing query/hash and unneeded SDK metadata. */
export const sanitizePostHogEvent = (event: CaptureResult | null): CaptureResult | null => {
  if (!event?.properties) return event;

  return {
    ...event,
    properties: sanitizePostHogProperties(event.properties),
    ...(event.$set ? { $set: sanitizePostHogProperties(event.$set) } : {}),
    ...(event.$set_once ? { $set_once: sanitizePostHogProperties(event.$set_once) } : {}),
  };
};
