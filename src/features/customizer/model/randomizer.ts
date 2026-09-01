import {
  FONT_CATALOG,
  TEMPLATE_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  hasActiveParameter,
  normalizeParams,
  parameterRange,
  orderedTemplateParameterKeys,
  type FontDefinition,
  type KeychainParams,
  type ShapeParameter,
  type TemplateId,
  type GeometryResult,
} from '../../../domain/keychain';

/** A source returning a value in [0, 1). Injectable so random designs are testable. */
export type RandomSource = () => number;

export type RandomizerOptions = {
  random?: RandomSource;
  fonts?: readonly FontDefinition[];
  templates?: readonly TemplateId[];
  randomizeShape?: boolean;
};

const boundedUnit = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999, Math.max(0, value));
};

const pick = <T>(items: readonly T[], random: RandomSource, current?: T): T | undefined => {
  if (!items.length) return undefined;
  const alternatives = current === undefined ? items : items.filter((item) => item !== current);
  const pool = alternatives.length ? alternatives : items;
  return pool[Math.floor(boundedUnit(random()) * pool.length)];
};

const randomValue = (params: KeychainParams, parameter: ShapeParameter, random: RandomSource) => {
  const range = parameterRange(params, parameter);
  const steps = Math.max(0, Math.round((range.max - range.min) / range.step));
  const step = Math.floor(boundedUnit(random()) * (steps + 1));
  return Number((range.min + step * range.step).toFixed(3));
};
const randomValueFor = (random: RandomSource, min: number, max: number, step: number): number => {
  const count = Math.max(0, Math.round((max - min) / step));
  return Number((min + Math.floor(boundedUnit(random()) * (count + 1)) * step).toFixed(3));
};

/**
 * Creates a valid, bounded variation while retaining the user's text.
 * Fonts are filtered for the current text and articulated template support.
 */
export const randomizeParams = (
  current: KeychainParams,
  options: RandomizerOptions = {},
): KeychainParams => {
  const random = options.random ?? Math.random;
  const templatePool = (
    options.templates ?? TEMPLATE_CATALOG.map((template) => template.id)
  ).filter(
    (id): id is TemplateId =>
      TEMPLATE_CATALOG.some((template) => template.id === id) &&
      !(current.subtitle && id === 'articulated-name'),
  );
  const templateId = pick(templatePool, random, current.templateId) ?? current.templateId;
  const template = TEMPLATE_CATALOG.find((item) => item.id === templateId) ?? TEMPLATE_CATALOG[0];
  const styleId = template.styles.length
    ? (pick(template.styles, random, current.styleId) ?? template.styles[0])
    : 'contour';
  const candidateFonts = (options.fonts ?? FONT_CATALOG).filter((font) =>
    templateId === 'articulated-name'
      ? fontSupportsArticulatedName(font, current.text)
      : fontSupportsText(font, current.text),
  );
  const fontId =
    pick(
      candidateFonts.map((font) => font.id),
      random,
      current.fontId,
    ) ?? current.fontId;
  const subtitleFonts = (options.fonts ?? FONT_CATALOG).filter(
    (font) => !current.subtitle || fontSupportsText(font, current.subtitle),
  );
  const subtitleFontId =
    pick(
      subtitleFonts.map((font) => font.id),
      random,
      current.subtitleFontId,
    ) ?? current.subtitleFontId;
  let next: KeychainParams = { ...current, templateId, styleId, fontId, subtitleFontId };

  if (options.randomizeShape !== false) {
    for (const parameter of orderedTemplateParameterKeys(templateId)) {
      if (hasActiveParameter(next, parameter)) {
        next = { ...next, [parameter]: randomValue(next, parameter, random) };
      }
    }
    if (templateId === 'plant-label') next = { ...next, plantAccentEnabled: random() >= 0.5 };
    if (templateId !== 'articulated-name' && current.subtitle) {
      next = {
        ...next,
        subtitleTextSizeMm: randomValueFor(random, 4, 12, 0.5),
        subtitleFontWeightMm: randomValueFor(random, 0, 1.5, 0.1),
        subtitleLetterSpacingMm: randomValueFor(random, 0, 4, 0.1),
        subtitleReliefDepthMm: randomValueFor(random, 0.4, 1.5, 0.1),
        subtitleGapMm: randomValueFor(random, 1.5, 8, 0.1),
        subtitleOffsetXRatio: randomValueFor(random, -1, 1, 0.05),
        subtitleOffsetYRatio: randomValueFor(random, -1, 1, 0.05),
      };
    }
  }
  return normalizeParams(next);
};

export type RandomizeValidationResult =
  boolean | { printable: boolean } | Pick<GeometryResult, 'printable' | 'issues'> | GeometryResult;
export type RandomizeValidation = (candidate: KeychainParams) => Promise<RandomizeValidationResult>;

export type RandomizeTransaction = {
  status: 'accepted' | 'exhausted' | 'cancelled';
  params: KeychainParams;
  result?: GeometryResult;
  attempts: number;
};

/** Try bounded candidates and keep the original if every candidate has a geometry error. */
export const randomizeWithValidation = async (
  current: KeychainParams,
  validate: RandomizeValidation,
  options: RandomizerOptions & { attempts?: number } = {},
): Promise<RandomizeTransaction> => {
  const attempts = Math.max(1, Math.min(12, options.attempts ?? 6));
  for (let index = 0; index < attempts; index += 1) {
    const candidate = randomizeParams(current, options);
    try {
      const result = await validate(candidate);
      const accepted =
        typeof result === 'boolean'
          ? result
          : result.printable &&
            (!('issues' in result) || !result.issues.some((issue) => issue.severity === 'error'));
      if (accepted)
        return {
          status: 'accepted',
          params: candidate,
          result: typeof result === 'boolean' || !('baseMesh' in result) ? undefined : result,
          attempts: index + 1,
        };
    } catch {
      continue;
    }
  }
  return { status: 'exhausted', params: current, attempts };
};
