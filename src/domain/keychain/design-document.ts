import { STYLE_CATALOG } from './styles/style-builder';
import { TEMPLATE_CATALOG } from './templates/template-builder';
import { PARAMETER_RANGES, parameterRange, type ShapeParameter } from './model/parameters';
import { FONT_CATALOG } from './fonts/catalog';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  type KeychainParams,
  type PrintAppearanceOverrides,
} from './model/types';

export type DesignDocument = {
  version: 1;
  params: KeychainParams;
  appearanceOverrides?: PrintAppearanceOverrides;
  fontFallback?: boolean;
};

const V2_PREFIX = 'v2.';
const COMPACT_PARAM_KEYS: Record<keyof KeychainParams, string> = {
  text: 't',
  fontId: 'f',
  templateId: 'm',
  styleId: 's',
  textHeightMm: 'h',
  fontWeightMm: 'w',
  baseThicknessMm: 'b',
  reliefDepthMm: 'r',
  paddingMm: 'p',
  edgeInsetMm: 'e',
  letterSpacingMm: 'l',
  holeDiameterMm: 'd',
  connectorWidthMm: 'c',
  cornerRadiusMm: 'k',
  stakeLengthMm: 'q',
  plantAccentEnabled: 'a',
  nameplateTiltDeg: 'i',
  nameplateEmbedMm: 'n',
  jointClearanceMm: 'j',
  mechanicalGapMm: 'g',
  maxJointAngleDeg: 'x',
  minimumWallMm: 'u',
  bottomClearanceMm: 'o',
};
const COMPACT_TO_PARAM = Object.fromEntries(
  Object.entries(COMPACT_PARAM_KEYS).map(([key, compact]) => [compact, key]),
) as Record<string, keyof KeychainParams>;

const PARAM_KEYS = Object.keys(DEFAULT_PARAMS) as Array<keyof KeychainParams>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidParams = (value: unknown): value is KeychainParams => {
  if (!isRecord(value) || PARAM_KEYS.some((key) => !(key in value))) return false;
  if (typeof value.text !== 'string' || value.text.trim().length === 0 || value.text.length > 200)
    return false;
  if (typeof value.fontId !== 'string' || value.fontId.length > 200) return false;
  if (!TEMPLATE_CATALOG.some((item) => item.id === value.templateId)) return false;
  if (!STYLE_CATALOG.some((item) => item.id === value.styleId)) return false;
  return PARAM_KEYS.every((key) => {
    const field = value[key];
    if (key === 'text' || key === 'fontId' || key === 'templateId' || key === 'styleId')
      return typeof field === 'string';
    if (key === 'plantAccentEnabled') return typeof field === 'boolean';
    return (
      typeof field === 'number' &&
      Number.isFinite(field) &&
      (key in PARAMETER_RANGES
        ? field >= parameterRange(value as KeychainParams, key as ShapeParameter).min &&
          field <= parameterRange(value as KeychainParams, key as ShapeParameter).max
        : key === 'minimumWallMm'
          ? field >= 0.8 && field <= 3
          : key === 'bottomClearanceMm'
            ? field >= 0.15 && field <= 0.6
            : true)
    );
  });
};

const isValidAppearance = (value: unknown): value is PrintAppearanceOverrides => {
  if (!isRecord(value) || value.version !== 1) return false;
  if (Object.keys(value).some((key) => !['version', 'base', 'relief'].includes(key))) return false;
  return ['base', 'relief'].every((key) => {
    const color = value[key];
    return color === undefined || (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color));
  });
};

const bytesToBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBytes = (encoded: string): Uint8Array => {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid design encoding');
  const padded =
    encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const encodeDesignDocument = (document: DesignDocument): string => {
  if (
    document.version !== 1 ||
    !isValidParams(document.params) ||
    (document.appearanceOverrides !== undefined && !isValidAppearance(document.appearanceOverrides))
  )
    throw new Error('Invalid design document');
  const bundledFont = FONT_CATALOG.some((font) => font.id === document.params.fontId);
  const safeDocument: DesignDocument = {
    ...document,
    params: bundledFont ? document.params : { ...document.params, fontId: FONT_CATALOG[0].id },
    ...(bundledFont ? {} : { fontFallback: true }),
  };
  const compactParams: Record<string, unknown> = {};
  PARAM_KEYS.forEach((key) => {
    if (!Object.is(safeDocument.params[key], DEFAULT_PARAMS[key])) {
      compactParams[COMPACT_PARAM_KEYS[key]] = safeDocument.params[key];
    }
  });
  const compact: Record<string, unknown> = { p: compactParams };
  if (safeDocument.appearanceOverrides?.base || safeDocument.appearanceOverrides?.relief) {
    compact.a = {
      ...(safeDocument.appearanceOverrides.base
        ? { b: safeDocument.appearanceOverrides.base }
        : {}),
      ...(safeDocument.appearanceOverrides.relief
        ? { r: safeDocument.appearanceOverrides.relief }
        : {}),
    };
  }
  if (safeDocument.fontFallback) compact.ff = true;
  return `${V2_PREFIX}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(compact)))}`;
};

export const decodeDesignDocument = (encoded: string): DesignDocument | undefined => {
  try {
    if (encoded.length > 24_000) return undefined;
    const isV2 = encoded.startsWith(V2_PREFIX);
    const payload = isV2
      ? encoded.slice(V2_PREFIX.length)
      : encoded.startsWith('v1.')
        ? encoded.slice(3)
        : encoded;
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (isV2) return decodeV2Document(parsed);
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      Object.keys(parsed).some(
        (key) => !['version', 'params', 'appearanceOverrides', 'fontFallback'].includes(key),
      ) ||
      !isValidParams(parsed.params) ||
      (parsed.appearanceOverrides !== undefined && !isValidAppearance(parsed.appearanceOverrides))
    )
      return undefined;
    if (parsed.fontFallback !== undefined && typeof parsed.fontFallback !== 'boolean')
      return undefined;
    const params = parsed.params as KeychainParams;
    if (!FONT_CATALOG.some((font) => font.id === params.fontId)) return undefined;
    return {
      version: 1,
      params: normalizeParams(params),
      ...(parsed.appearanceOverrides ? { appearanceOverrides: parsed.appearanceOverrides } : {}),
      ...(parsed.fontFallback ? { fontFallback: true } : {}),
    };
  } catch {
    return undefined;
  }
};

const decodeV2Document = (parsed: unknown): DesignDocument | undefined => {
  if (!isRecord(parsed) || !isRecord(parsed.p)) return undefined;
  if (Object.keys(parsed).some((key) => !['p', 'a', 'ff'].includes(key))) return undefined;
  const compactParams = parsed.p;
  if (Object.keys(compactParams).some((key) => !(key in COMPACT_TO_PARAM))) return undefined;
  const params = { ...DEFAULT_PARAMS } as KeychainParams;
  for (const [compactKey, value] of Object.entries(compactParams)) {
    params[COMPACT_TO_PARAM[compactKey]] = value as never;
  }
  if (!isValidParams(params)) return undefined;
  let appearanceOverrides: PrintAppearanceOverrides | undefined;
  if (parsed.a !== undefined) {
    if (!isRecord(parsed.a) || Object.keys(parsed.a).some((key) => !['b', 'r'].includes(key)))
      return undefined;
    const { b, r } = parsed.a;
    if (
      (b !== undefined && (typeof b !== 'string' || !/^#[0-9a-f]{6}$/i.test(b))) ||
      (r !== undefined && (typeof r !== 'string' || !/^#[0-9a-f]{6}$/i.test(r)))
    )
      return undefined;
    if (b !== undefined || r !== undefined)
      appearanceOverrides = {
        version: 1,
        ...(b !== undefined ? { base: b as `#${string}` } : {}),
        ...(r !== undefined ? { relief: r as `#${string}` } : {}),
      };
  }
  if (parsed.ff !== undefined && typeof parsed.ff !== 'boolean') return undefined;
  if (!FONT_CATALOG.some((font) => font.id === params.fontId)) return undefined;
  return {
    version: 1,
    params: normalizeParams(params),
    ...(appearanceOverrides ? { appearanceOverrides } : {}),
    ...(parsed.ff ? { fontFallback: true } : {}),
  };
};
