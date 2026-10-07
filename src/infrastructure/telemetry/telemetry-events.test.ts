import type { CaptureResult } from 'posthog-js';

import { describe, expect, it } from 'vitest';

import { sanitizePostHogEvent, sanitizeProperties } from './events';

describe('analytics event properties', () => {
  it('keeps low-cardinality scalar properties and removes undefined values', () => {
    expect(
      sanitizeProperties('geometry_ready', {
        locale: 'en',
        template: 'name-keychain',
        count: 2,
        enabled: true,
      }),
    ).toEqual({ locale: 'en', template: 'name-keychain', count: 2, enabled: true });
  });

  it('rejects unsafe property names', () => {
    expect(
      sanitizeProperties('page_view', {
        'raw name': 'ALEX',
        'query-string': 'secret',
        path: '/create?name=ALEX#preview',
        ok: 'yes',
      }),
    ).toEqual({ path: '/create', ok: 'yes' });
  });

  it('accepts only fixed setup steps and stable option IDs', () => {
    expect(
      sanitizeProperties('setup_step_viewed', {
        step: 'keyring-opening',
        name: 'ALEX',
        width: 80,
      }),
    ).toEqual({ step: 'keyring-opening' });
    expect(sanitizeProperties('setup_step_viewed', { step: 'ALEX' })).toEqual({});
    expect(
      sanitizeProperties('customizer_option_changed', {
        family: 'keyring_opening',
        option_id: 'oval-slot',
        width: 8,
      }),
    ).toEqual({ family: 'keyring_opening', option_id: 'oval-slot' });
    expect(
      sanitizeProperties('customizer_option_changed', {
        family: 'keyring_opening',
        option_id: 'ALEX',
      }),
    ).toEqual({ family: 'keyring_opening' });
    expect(
      sanitizeProperties('customizer_option_changed', {
        family: 'keyring_opening',
        option_id: 'custom',
      }),
    ).toEqual({ family: 'keyring_opening', option_id: 'custom' });
  });

  it('keeps only SDK route URLs and removes identifying or high-detail SDK metadata', () => {
    const event: CaptureResult = {
      uuid: 'event-id',
      event: 'page_view',
      properties: {
        token: 'project-token',
        $current_url: 'https://open-keychain.com/create?name=ALEX#preview',
        $initial_current_url: 'https://open-keychain.com/create?design=private',
        $referrer: 'https://search.example/?q=private',
        $raw_user_agent: 'browser detail',
        $viewport_width: 390,
        $geoip_city_name: 'Example city',
        $pathname: '/create',
      },
    };

    expect(sanitizePostHogEvent(event)?.properties).toEqual({
      token: 'project-token',
      $current_url: 'https://open-keychain.com/create',
      $initial_current_url: 'https://open-keychain.com/create',
      $pathname: '/create',
    });
    expect(event.properties.$current_url).toBe(
      'https://open-keychain.com/create?name=ALEX#preview',
    );
  });

  it('removes attribution from event and person-property containers', () => {
    const event: CaptureResult = {
      uuid: 'event-id',
      event: 'survey sent',
      properties: {
        $current_url: 'https://open-keychain.com/create?utm_campaign=private',
        $referrer: 'https://search.example/?q=private',
        $search_engine: 'google',
        ph_keyword: 'private phrase',
        utm_source: 'private source',
        $initial_gclid: 'private click id',
        $session_entry_utm_medium: 'private medium',
        $geoip_city_name: 'Example city',
        $pathname: '/create',
      },
      $set: {
        '$survey_interaction/survey-id/responded': true,
        $referring_domain: 'search.example',
        $initial_search_engine: 'google',
        gclid: 'private click id',
        $initial_current_url: 'https://open-keychain.com/create?name=ALEX',
        $geoip_city_name: 'Example city',
      },
      $set_once: {
        $session_entry_url: 'https://open-keychain.com/create?email=private',
        utm_campaign: 'private campaign',
        safe_category: 'review',
      },
    };

    expect(sanitizePostHogEvent(event)).toEqual({
      ...event,
      properties: {
        $current_url: 'https://open-keychain.com/create',
        $pathname: '/create',
      },
      $set: {
        '$survey_interaction/survey-id/responded': true,
        $initial_current_url: 'https://open-keychain.com/create',
      },
      $set_once: {
        $session_entry_url: 'https://open-keychain.com/create',
        safe_category: 'review',
      },
    });
  });

  it('preserves PostHog null events', () => {
    expect(sanitizePostHogEvent(null)).toBeNull();
  });
});
