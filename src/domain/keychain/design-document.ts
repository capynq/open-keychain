import { FONT_CATALOG } from './fonts/catalog';
import {
  createDesignDocument,
  designParams,
  DESIGN_SECTIONS,
  type DesignDocument,
  type DesignSection,
} from './model/design-schema';
import { validateModelFeatures } from './model/model-feature';
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

const DOCUMENT_PREFIX = 'v6.';
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
  edgeFinish: 'ef',
  topEdgeMm: 'et',
  bottomEdgeMm: 'eb',
  textEdgeMm: 'er',
  modelFeatures: 'mf',
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
    if (key === 'modelFeatures') return validateModelFeatures(field);
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
    if (key === 'edgeFinish') return ['sharp', 'chamfer', 'round'].includes(field as string);
    if (key === 'topEdgeMm' || key === 'bottomEdgeMm' || key === 'textEdgeMm')
      return (
        typeof field === 'number' &&
        Number.isFinite(field) &&
        field >= 0 &&
        field <= (key === 'textEdgeMm' ? 1 : 2)
      );
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
  const params = designParams(document);
  if (
    document.version !== 6 ||
    !isValidParams(params) ||
    (document.appearanceOverrides !== undefined && !isValidAppearance(document.appearanceOverrides))
  )
    throw new Error('Invalid design document');
  const bundledFont = FONT_CATALOG.some((font) => font.id === params.fontId);
  const bundledSubtitleFont = FONT_CATALOG.some((font) => font.id === params.subtitleFontId);
  const safeParams = {
    ...params,
    ...(bundledFont ? {} : { fontId: FONT_CATALOG[0].id }),
    ...(bundledSubtitleFont ? {} : { subtitleFontId: FONT_CATALOG[0].id }),
  };
  const compact: Record<string, unknown> = {};
  for (const [section, keys] of Object.entries(DESIGN_SECTIONS)) {
    const values = Object.fromEntries(
      keys
        .filter((key) =>
          key === 'modelFeatures'
            ? Boolean(safeParams.modelFeatures?.length)
            : !Object.is(safeParams[key], DEFAULT_PARAMS[key]),
        )
        .map((key) => [COMPACT_PARAM_KEYS[key], safeParams[key]]),
    );
    if (Object.keys(values).length) compact[section] = values;
  }
  if (document.appearanceOverrides?.base || document.appearanceOverrides?.relief) {
    compact.a = {
      ...(document.appearanceOverrides.base ? { b: document.appearanceOverrides.base } : {}),
      ...(document.appearanceOverrides.relief ? { r: document.appearanceOverrides.relief } : {}),
    };
  }
  if (document.fontFallback || !bundledFont || !bundledSubtitleFont) compact.ff = true;
  return `${DOCUMENT_PREFIX}${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(compact)))}`;
};

export const decodeDesignDocument = (encoded: string): DesignDocument | undefined => {
  try {
    if (encoded.length > 24_000) return undefined;
    if (!encoded.startsWith(DOCUMENT_PREFIX)) return undefined;
    const payload = encoded.slice(DOCUMENT_PREFIX.length);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    return decodeCompactDocument(parsed);
  } catch {
    return undefined;
  }
};

const decodeCompactDocument = (parsed: unknown): DesignDocument | undefined => {
  if (!isRecord(parsed)) return undefined;
  if (
    Object.keys(parsed).some((key) => ![...Object.keys(DESIGN_SECTIONS), 'a', 'ff'].includes(key))
  )
    return undefined;
  const params = { ...DEFAULT_PARAMS } as KeychainParams;
  for (const section of Object.keys(DESIGN_SECTIONS) as DesignSection[]) {
    if (parsed[section] === undefined) continue;
    const values = parsed[section];
    if (!isRecord(values)) return undefined;
    for (const [compactKey, value] of Object.entries(values)) {
      // v6 compact documents may contain the removed separate-parts toggle.
      // It was an export acknowledgement, never a design parameter, so ignore
      // it while retaining compatibility with links created by older builds.
      if (compactKey === 'sp') {
        if (typeof value !== 'boolean') return undefined;
        continue;
      }
      const key = COMPACT_TO_PARAM[compactKey];
      if (!key || !(DESIGN_SECTIONS[section] as readonly string[]).includes(key)) return undefined;
      params[key] = value as never;
    }
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
    ...createDesignDocument(normalizeParams(params), appearanceOverrides),
    ...(parsed.ff ? { fontFallback: true } : {}),
  };
};
