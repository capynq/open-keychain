import type { CaptureResult } from 'posthog-js';

import { describe, expect, it } from 'vitest';

import { sanitizePostHogEvent, sanitizeProperties } from './events';

describe('analytics event properties', () => {
  it('allows only the fixed referral on page and event-specific payloads', () => {
    for (const event of ['landing_view', 'geometry_ready', 'export_completed'] as const) {
      expect(sanitizeProperties(event, { acquisition_source: 'portfolio' })).toEqual({
        acquisition_source: 'portfolio',
      });
      expect(
        sanitizeProperties(event, { acquisition_source: 'PRIVATE', utm_source: 'portfolio' }),
      ).toEqual({});
    }
  });

  it('keeps only the fixed referral through the final SDK scrub', () => {
    const event: CaptureResult = {
      uuid: 'event-id',
      event: 'export_completed',
      properties: {
        acquisition_source: 'portfolio',
        utm_source: 'portfolio',
        $current_url: 'https://open-keychain.com/?utm_source=portfolio&name=PRIVATE',
      },
      $set: { acquisition_source: 'PRIVATE' },
      $set_once: { acquisition_source: 'PRIVATE' },
    };
    expect(sanitizePostHogEvent(event)).toEqual({
      ...event,
      properties: { acquisition_source: 'portfolio', $current_url: 'https://open-keychain.com/' },
      $set: {},
      $set_once: {},
    });
  });

  it('keeps low-cardinality scalar properties and removes undefined values', () => {
    expect(
      sanitizeProperties('page_view', {
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

  it('accepts only fixed environment markers and bounded attempt metadata', () => {
    expect(
      sanitizeProperties('export_completed', {
        environment: 'production',
        internal_traffic: true,
        design_id: '8fbad08e-7287-4a03-8be5-56ddfec47839',
        export_attempt_id: '7e76c249-8b61-465c-8b5f-b687d7284d44',
        duration_ms: 523,
        app_version: 'abcdef0123456789abcdef0123456789abcdef01',
        app_release: `0.1.0-beta.1+${'abcdef0123456789abcdef0123456789abcdef01'}`,
        outcome: 'success',
        name: 'ALEX',
        width: 80,
      }),
    ).toEqual({
      environment: 'production',
      internal_traffic: true,
      design_id: '8fbad08e-7287-4a03-8be5-56ddfec47839',
      export_attempt_id: '7e76c249-8b61-465c-8b5f-b687d7284d44',
      duration_ms: 523,
      app_version: 'abcdef0123456789abcdef0123456789abcdef01',
      app_release: `0.1.0-beta.1+${'abcdef0123456789abcdef0123456789abcdef01'}`,
      outcome: 'success',
    });
    expect(
      sanitizeProperties('export_failed', {
        environment: 'staging',
        internal_traffic: 'yes',
        export_attempt_id: 'ALEX 80mm',
        duration_ms: Number.POSITIVE_INFINITY,
        app_version: 'local',
        app_release: 'not a safe release',
        error_code: 'ALEX not manifold',
      }),
    ).toEqual({});
    expect(
      sanitizeProperties('export_failed', {
        export_attempt_id: '7e76c249-8b61-465c-8b5f-b687d7284d44',
        outcome: 'error',
        error_code: 'timeout',
      }),
    ).toEqual({
      export_attempt_id: '7e76c249-8b61-465c-8b5f-b687d7284d44',
      outcome: 'error',
      error_code: 'timeout',
    });
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
  it('allows only fixed export failure diagnostics and rejects model data', () => {
    expect(
      sanitizeProperties('export_failed', {
        failure_stage: 'serialization',
        error_type: 'operation_error',
        message: 'private model text',
        text: 'private model text',
      }),
    ).toEqual({ failure_stage: 'serialization', error_type: 'operation_error' });
    expect(
      sanitizeProperties('export_failed', {
        failure_stage: 'private model text',
        error_type: 'RangeError: private model text',
      }),
    ).toEqual({});
    expect(
      sanitizeProperties('export_completed', {
        failure_stage: 'serialization',
        error_type: 'operation_error',
      }),
    ).toEqual({});
  });

  it('keeps structured validation outcomes and fixed control IDs while rejecting design data', () => {
    expect(
      sanitizeProperties('geometry_attempt_finished', {
        template: 'heart',
        operation: 'validation',
        geometry_attempt_id: '35cc5a1a-276c-4fe7-83cd-a92ee8f44931',
        outcome: 'rejected',
        failure_code: 'wall-too-thin',
        failure_stage: 'generation',
        control_group: 'print',
        control_key: 'baseThicknessMm',
        text: 'PRIVATE TEXT',
        font_file: 'PRIVATE FONT',
      }),
    ).toEqual({
      template: 'heart',
      operation: 'validation',
      geometry_attempt_id: '35cc5a1a-276c-4fe7-83cd-a92ee8f44931',
      outcome: 'rejected',
      failure_code: 'wall-too-thin',
      failure_stage: 'generation',
      control_group: 'print',
      control_key: 'baseThicknessMm',
    });
    expect(
      sanitizeProperties('geometry_attempt_finished', {
        outcome: 'rejected',
        failure_code: 'PRIVATE TEXT',
        control_group: 'PRIVATE TEXT',
        control_key: 'text',
      }),
    ).toEqual({ outcome: 'rejected', control_key: 'text' });
  });

  it('keeps the preview generation ID on the correlated ready event', () => {
    expect(
      sanitizeProperties('geometry_ready', {
        template: 'heart',
        locale: 'en',
        geometry_attempt_id: '35cc5a1a-276c-4fe7-83cd-a92ee8f44931',
        geometry_generation_id: 14,
        outcome: 'success',
      }),
    ).toEqual({
      template: 'heart',
      locale: 'en',
      geometry_attempt_id: '35cc5a1a-276c-4fe7-83cd-a92ee8f44931',
      geometry_generation_id: 14,
      outcome: 'success',
    });
  });
});
