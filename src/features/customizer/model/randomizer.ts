import {
  FONT_CATALOG,
  TEMPLATE_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  hasActiveParameter,
  normalizeParams,
  parameterRange,
  templateParameterKeys,
  type FontDefinition,
  type KeychainParams,
  type ShapeParameter,
  type TemplateId,
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
  ).filter((id): id is TemplateId => TEMPLATE_CATALOG.some((template) => template.id === id));
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
  let next: KeychainParams = { ...current, templateId, styleId, fontId };

  if (options.randomizeShape !== false) {
    for (const parameter of templateParameterKeys(templateId)) {
      if (hasActiveParameter(next, parameter)) {
        next = { ...next, [parameter]: randomValue(next, parameter, random) };
      }
    }
    if (templateId === 'plant-label') next = { ...next, plantAccentEnabled: random() >= 0.5 };
  }
  return normalizeParams(next);
};

export type RandomizeValidation = (candidate: KeychainParams) => Promise<boolean>;

/** Try bounded candidates and keep the original if every candidate has a geometry error. */
export const randomizeWithValidation = async (
  current: KeychainParams,
  validate: RandomizeValidation,
  options: RandomizerOptions & { attempts?: number } = {},
): Promise<KeychainParams> => {
  const attempts = Math.max(1, Math.min(12, options.attempts ?? 6));
  for (let index = 0; index < attempts; index += 1) {
    const candidate = randomizeParams(current, options);
    if (await validate(candidate)) return candidate;
  }
  return current;
};
