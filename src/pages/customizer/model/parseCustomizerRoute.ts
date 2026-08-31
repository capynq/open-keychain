import {
  DEFAULT_PARAMS,
  decodeDesignDocument,
  normalizeParams,
  TEMPLATE_CATALOG,
} from '../../../entities/keychain';
import type {
  KeychainParams,
  PrintAppearanceOverrides,
  TemplateId,
} from '../../../entities/keychain';

type CustomizerLocationState = {
  projectParams?: Record<string, unknown>;
};

export type CustomizerRouteModel = {
  initialParams?: KeychainParams;
  initialAppearanceOverrides?: PrintAppearanceOverrides;
  routeInputKey?: string;
  hasInvalidDesign: boolean;
  sharedFontFallback: boolean;
};

export const parseCustomizerRoute = (search: string, state: unknown): CustomizerRouteModel => {
  const projectParams = (state as CustomizerLocationState | null)?.projectParams;
  const searchParams = new URLSearchParams(search);
  const designValue = searchParams.get('design');
  const sharedDocument = designValue ? decodeDesignDocument(designValue) : undefined;
  const requestedTemplate = searchParams.get('template');
  const templateId = TEMPLATE_CATALOG.some((template) => template.id === requestedTemplate)
    ? (requestedTemplate as TemplateId)
    : undefined;
  const initialParams: KeychainParams | undefined =
    sharedDocument?.params ??
    (projectParams
      ? normalizeParams({ ...DEFAULT_PARAMS, ...projectParams } as KeychainParams)
      : templateId
        ? normalizeParams({ ...DEFAULT_PARAMS, templateId })
        : undefined);

  return {
    initialParams,
    initialAppearanceOverrides: sharedDocument?.appearanceOverrides,
    routeInputKey: designValue ?? undefined,
    hasInvalidDesign: searchParams.has('design') && !sharedDocument,
    sharedFontFallback: Boolean(sharedDocument?.fontFallback),
  };
};
