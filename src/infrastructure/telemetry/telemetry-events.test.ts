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

  it('accepts only integer worker replacement counts from 0 to 20 on attempt and error events', () => {
    for (const event of ['geometry_attempt_finished', 'geometry_error'] as const) {
      expect(sanitizeProperties(event, { worker_replacements: 0 })).toEqual({
        worker_replacements: 0,
      });
      expect(sanitizeProperties(event, { worker_replacements: 20 })).toEqual({
        worker_replacements: 20,
      });
      for (const value of [-1, 21, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '2']) {
        expect(sanitizeProperties(event, { worker_replacements: value as number })).toEqual({});
      }
    }
    expect(sanitizeProperties('geometry_ready', { worker_replacements: 1 })).toEqual({});
  });

  it('accepts the auto replacement trigger only on geometry attempt events', () => {
    for (const event of ['geometry_attempt_started', 'geometry_attempt_finished'] as const) {
      expect(sanitizeProperties(event, { recovery_trigger: 'auto_replacement' })).toEqual({
        recovery_trigger: 'auto_replacement',
      });
    }
    expect(sanitizeProperties('export_started', { recovery_trigger: 'auto_replacement' })).toEqual(
      {},
    );
    expect(sanitizeProperties('export_failed', { recovery_trigger: 'auto_replacement' })).toEqual(
      {},
    );
    expect(
      sanitizeProperties('geometry_attempt_started', { recovery_trigger: 'user_edit' }),
    ).toEqual({
      recovery_trigger: 'user_edit',
    });
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

  it('keeps geometry and preview timing properties with their expected types', () => {
    expect(
      sanitizeProperties('geometry_ready', {
        template: 'heart',
        wasm_wait_ms: 12,
        worker_compute_ms: 340,
        client_round_trip_ms: 380,
        client_queue_ms: 0,
        worker_boot_ms: 1200,
        cache_hit: false,
        cold_start: true,
      }),
    ).toEqual({
      template: 'heart',
      wasm_wait_ms: 12,
      worker_compute_ms: 340,
      client_round_trip_ms: 380,
      client_queue_ms: 0,
      worker_boot_ms: 1200,
      cache_hit: false,
      cold_start: true,
    });
    expect(
      sanitizeProperties('preview_rendered', {
        geometry_generation_id: 14,
        template: 'heart',
        mesh_setup_ms: 8,
        draw_submit_ms: 3,
        initialization_ms: 450,
        cold_start: true,
      }),
    ).toEqual({
      geometry_generation_id: 14,
      template: 'heart',
      mesh_setup_ms: 8,
      draw_submit_ms: 3,
      initialization_ms: 450,
      cold_start: true,
    });
  });

  it('rejects malformed geometry and preview timing properties', () => {
    expect(sanitizeProperties('geometry_ready', { worker_compute_ms: '340' })).toEqual({});
    expect(sanitizeProperties('geometry_ready', { wasm_wait_ms: -1 })).toEqual({});
    expect(sanitizeProperties('preview_rendered', { mesh_setup_ms: 600_001 })).toEqual({});
    expect(sanitizeProperties('preview_rendered', { cold_start: 'true' })).toEqual({});
    expect(sanitizeProperties('geometry_ready', { cache_hit: 1 })).toEqual({});
    expect(sanitizeProperties('geometry_ready', { template: 'Heart Shape' })).toEqual({});
  });

  it('accepts the 600000 ms boundary and rejects non-finite timing values', () => {
    expect(sanitizeProperties('geometry_ready', { worker_boot_ms: 600_000 })).toEqual({
      worker_boot_ms: 600_000,
    });
    expect(sanitizeProperties('preview_rendered', { draw_submit_ms: 600_000 })).toEqual({
      draw_submit_ms: 600_000,
    });
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(sanitizeProperties('geometry_ready', { client_queue_ms: value })).toEqual({});
      expect(sanitizeProperties('preview_rendered', { mesh_setup_ms: value })).toEqual({});
    }
  });

  it('allows only the fixed preview quality tiers on geometry_ready and preview_rendered', () => {
    for (const event of ['geometry_ready', 'preview_rendered'] as const) {
      for (const tier of ['high', 'medium', 'low'] as const) {
        expect(sanitizeProperties(event, { preview_quality: tier })).toEqual({
          preview_quality: tier,
        });
      }
      expect(sanitizeProperties(event, { preview_quality: 'ultra' })).toEqual({});
      expect(sanitizeProperties(event, { preview_quality: 1 })).toEqual({});
    }
    expect(sanitizeProperties('export_completed', { preview_quality: 'low' })).toEqual({});
    expect(sanitizeProperties('landing_view', { preview_quality: 'low' })).toEqual({});
  });

  it('allows timing properties only on geometry_ready and preview_rendered', () => {
    expect(sanitizeProperties('landing_view', { wasm_wait_ms: 5 })).toEqual({});
    expect(sanitizeProperties('export_completed', { cold_start: true })).toEqual({});
    expect(sanitizeProperties('preview_rendered', { wasm_wait_ms: 5 })).toEqual({});
    expect(sanitizeProperties('geometry_attempt_finished', { cache_hit: false })).toEqual({});
  });

  it('keeps only fixed start sources and a boolean prefill flag, never the typed name', () => {
    expect(
      sanitizeProperties('start_designing', {
        source: 'hero',
        prefilled: true,
        text: 'OLIVER',
      }),
    ).toEqual({ source: 'hero', prefilled: true });
    expect(
      sanitizeProperties('start_designing', { source: 'template_card', template: 'name-keychain' }),
    ).toEqual({ source: 'template_card', template: 'name-keychain' });
    expect(sanitizeProperties('start_designing', { source: 'OLIVER', prefilled: 'yes' })).toEqual(
      {},
    );
  });

  it('keeps only the reason and a safe recovery code when visitors contact support', () => {
    expect(
      sanitizeProperties('support_contact_opened', {
        reason: 'error',
        recovery_code: 'geometry-export-failed',
        message: 'The file could not be created.',
      }),
    ).toEqual({ reason: 'error', recovery_code: 'geometry-export-failed' });
    expect(
      sanitizeProperties('support_contact_opened', { reason: 'other', recovery_code: 'A B' }),
    ).toEqual({});
  });
});
