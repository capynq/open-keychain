import { FONT_CATALOG } from './fonts/catalog';
import {
  hasActiveParameter,
  PARAMETER_RANGES,
  parameterRange,
  type ShapeParameter,
} from './model/parameters';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  type KeychainParams,
  type PrintAppearanceOverrides,
} from './model/types';
import { STYLE_CATALOG } from './styles/style-builder';
import { TEMPLATE_CATALOG } from './templates/template-builder';

export type DesignDocument = {
  version: 5;
  params: KeychainParams;
  appearanceOverrides?: PrintAppearanceOverrides;
  fontFallback?: boolean;
};

const V5_PREFIX = 'v5.';
const COMPACT_PARAM_KEYS: Record<keyof KeychainParams, string> = {
  text: 't',
  subtitle: 'st',
  subtitleFontId: 'sf',
  subtitleOffsetXRatio: 'sx',
  subtitleOffsetYRatio: 'sy',
  magnetPocketPreset: 'mp',
  magnetPocketPlacement: 'mn',
  fontId: 'f',
  templateId: 'm',
  styleId: 's',
  textSizeMm: 'h',
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
  reliefHaloMm: 'y',
  ringOffsetMm: 'z',
  bubbleLobeMm: 'aa',
  tagTailMm: 'ab',
  archCurveMm: 'ac',
  stakeShoulderMm: 'ad',
  jointBossMm: 'ae',
  ribbonTailMm: 'af',
  ribbonNotchMm: 'ag',
  subtitleTextSizeMm: 'ah',
  subtitleFontWeightMm: 'ai',
  subtitleLetterSpacingMm: 'aj',
  subtitleReliefDepthMm: 'ak',
  subtitleGapMm: 'al',
  heartSizeMm: 'am',
  heartBorderMm: 'an',
  heartLeftGapMm: 'ao',
  heartRightGapMm: 'ap',
  heartVerticalOffsetMm: 'aq',
  heartInteriorMode: 'ar',
};
const COMPACT_TO_PARAM = Object.fromEntries(
  Object.entries(COMPACT_PARAM_KEYS).map(([key, compact]) => [compact, key]),
) as Record<string, keyof KeychainParams>;

const PARAM_KEYS = Object.keys(DEFAULT_PARAMS) as Array<keyof KeychainParams>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidParams = (value: unknown): value is KeychainParams => {
  if (!isRecord(value) || PARAM_KEYS.some((key) => !(key in value))) return false;
  const allowsEmptyText = value.styleId === 'heart-split' && value.templateId === 'name-keychain';
  if (
    allowsEmptyText &&
    typeof value.text === 'string' &&
    !value.text.trim() &&
    !(typeof value.subtitle === 'string' && value.subtitle.trim())
  )
    return false;
  if (
    typeof value.text !== 'string' ||
    (!allowsEmptyText && value.text.trim().length === 0) ||
    value.text.length > 200
  )
    return false;
  if (typeof value.fontId !== 'string' || value.fontId.length > 200) return false;
  if (!TEMPLATE_CATALOG.some((item) => item.id === value.templateId)) return false;
  if (!STYLE_CATALOG.some((item) => item.id === value.styleId)) return false;
  return PARAM_KEYS.every((key) => {
    const field = value[key];
    if (
      key === 'text' ||
      key === 'subtitle' ||
      key === 'subtitleFontId' ||
      key === 'magnetPocketPreset' ||
      key === 'magnetPocketPlacement' ||
      key === 'fontId' ||
      key === 'templateId' ||
      key === 'styleId'
    )
      return key === 'magnetPocketPreset'
        ? ['6x2', '8x2', '10x3', '12x3', '15x3'].includes(field as string)
        : key === 'magnetPocketPlacement'
          ? ['center', 'upper', 'lower', 'left', 'right'].includes(field as string)
          : typeof field === 'string';
    if (key === 'heartInteriorMode') return field === 'relief' || field === 'through-cut';
    if (key === 'plantAccentEnabled') return typeof field === 'boolean';
    if (key === 'subtitleOffsetXRatio' || key === 'subtitleOffsetYRatio')
      return typeof field === 'number' && Number.isFinite(field) && field >= -1 && field <= 1;
    return (
      typeof field === 'number' &&
      Number.isFinite(field) &&
      (key in PARAMETER_RANGES
        ? (!hasActiveParameter(value as KeychainParams, key as ShapeParameter) && field === 0) ||
          (field >= parameterRange(value as KeychainParams, key as ShapeParameter).min &&
            field <= parameterRange(value as KeychainParams, key as ShapeParameter).max)
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
    document.version !== 5 ||
    !isValidParams(document.params) ||
    (document.appearanceOverrides !== undefined && !isValidAppearance(document.appearanceOverrides))
  )
    throw new Error('Invalid design document');
  const bundledFont = FONT_CATALOG.some((font) => font.id === document.params.fontId);
  const bundledSubtitleFont = FONT_CATALOG.some(
    (font) => font.id === document.params.subtitleFontId,
  );
  const safeDocument: DesignDocument = {
    ...document,
    params:
      bundledFont && bundledSubtitleFont
        ? document.params
        : {
            ...document.params,
            ...(bundledFont ? {} : { fontId: FONT_CATALOG[0].id }),
            ...(bundledSubtitleFont ? {} : { subtitleFontId: FONT_CATALOG[0].id }),
          },
    ...(bundledFont && bundledSubtitleFont ? {} : { fontFallback: true }),
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
  return `${V5_PREFIX}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(compact)))}`;
};

export const decodeDesignDocument = (encoded: string): DesignDocument | undefined => {
  try {
    if (encoded.length > 24_000) return undefined;
    if (!encoded.startsWith(V5_PREFIX)) return undefined;
    const payload = encoded.slice(V5_PREFIX.length);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    return decodeCompactDocument(parsed);
  } catch {
    return undefined;
  }
};

const decodeCompactDocument = (parsed: unknown): DesignDocument | undefined => {
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
  if (!FONT_CATALOG.some((font) => font.id === params.subtitleFontId)) return undefined;
  return {
    version: 5,
    params: normalizeParams(params),
    ...(appearanceOverrides ? { appearanceOverrides } : {}),
    ...(parsed.ff ? { fontFallback: true } : {}),
  };
};
