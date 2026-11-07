import type {
  KeychainParams,
  PrintAppearanceOverrides,
  TemplateId,
} from '@/entities/keychain/model/types';

import { designParams } from '@/domain/keychain/model/design-schema';
import { decodeDesignDocument } from '@/entities/keychain/design-document';
import {
  articulatedFallbackFont,
  fontDefinition,
  fontSupportsArticulatedName,
} from '@/entities/keychain/fonts/catalog';
import { DEFAULT_PARAMS, normalizeParams } from '@/entities/keychain/model/types';
import { TEMPLATE_CATALOG } from '@/entities/keychain/templates/template-builder';
import { SETUP_TEXT_LIMIT } from '@/shared/lib/create-path';

type CustomizerLocationState = {
  projectParams?: Record<string, unknown>;
  /** Name typed on the landing page; prefills quick setup without touching the URL. */
  setupText?: unknown;
};

export type CustomizerRouteModel = {
  initialParams?: KeychainParams;
  initialAppearanceOverrides?: PrintAppearanceOverrides;
  routeInputKey?: string;
  hasInvalidDesign: boolean;
  sharedFontFallback: boolean;
  setupText?: string;
};

const normalizeInitialParams = (params: KeychainParams): KeychainParams => {
  const normalized = normalizeParams(params);

  if (
    normalized.templateId === 'articulated-name' &&
    !fontSupportsArticulatedName(fontDefinition(normalized.fontId), normalized.text)
  ) {
    return { ...normalized, fontId: articulatedFallbackFont(normalized.text).id };
  }

  return normalized;
};

export const parseCustomizerRoute = (search: string, state: unknown): CustomizerRouteModel => {
  const locationState = state as CustomizerLocationState | null;
  const projectParams = locationState?.projectParams;
  const setupText =
    typeof locationState?.setupText === 'string'
      ? Array.from(locationState.setupText.trim()).slice(0, SETUP_TEXT_LIMIT).join('')
      : '';
  const searchParams = new URLSearchParams(search);
  const designValue = searchParams.get('design');
  const sharedDocument = designValue ? decodeDesignDocument(designValue) : undefined;
  const requestedTemplate = searchParams.get('template');
  const templateId = TEMPLATE_CATALOG.some((template) => template.id === requestedTemplate)
    ? (requestedTemplate as TemplateId)
    : undefined;
  const rawInitialParams: KeychainParams | undefined =
    (sharedDocument ? designParams(sharedDocument) : undefined) ??
    (projectParams
      ? ({ ...DEFAULT_PARAMS, ...projectParams } as KeychainParams)
      : templateId
        ? { ...DEFAULT_PARAMS, templateId }
        : undefined);
  const initialParams = rawInitialParams ? normalizeInitialParams(rawInitialParams) : undefined;

  return {
    initialParams,
    initialAppearanceOverrides: sharedDocument?.appearanceOverrides,
    routeInputKey: designValue ?? undefined,
    hasInvalidDesign: searchParams.has('design') && !sharedDocument,
    sharedFontFallback: Boolean(sharedDocument?.fontFallback),
    ...(setupText ? { setupText } : {}),
  };
};
