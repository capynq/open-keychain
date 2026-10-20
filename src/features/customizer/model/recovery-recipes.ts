import type { FontDefinition } from '@/domain/keychain/fonts/catalog';
import type { KeychainParams } from '@/domain/keychain/model/types';
import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import {
  FONT_CATALOG,
  fontSupportsText,
  fontSupportsArticulatedName,
} from '@/domain/keychain/fonts/catalog';
import { EDGE_FINISH_GRID_MM } from '@/domain/keychain/model/edge-finish';
import { recoveryDefinition } from '@/shared/lib/recovery/catalog';

import { simpleOptionGroups } from './simple-options';

export type RecoveryRecipe = {
  id: string;
  labelKey: string;
  values?: Record<string, string | number>;
  params: KeychainParams;
};
export type RecoveryOption = Omit<RecoveryRecipe, 'params'> & {
  status: 'checking' | 'ready' | 'unavailable';
};

/** Proposals are only recipes; none may be applied until its complete geometry is verified. */
export const recoveryRecipes = (
  params: KeychainParams,
  failure: RecoveryFailure,
  font: FontDefinition,
  controlKey?: keyof KeychainParams,
): RecoveryRecipe[] => {
  const strategy = recoveryDefinition(failure.code).strategy;
  const recipes: RecoveryRecipe[] = [];
  const add = (
    id: string,
    labelKey: string,
    changes: Partial<KeychainParams>,
    values?: RecoveryRecipe['values'],
  ): void => {
    recipes.push({ id, labelKey, values, params: { ...params, ...changes } });
  };
  if (strategy === 'text-edge' || strategy === 'base-edge') {
    const base = strategy === 'base-edge';
    const maximum = failure.context?.maximumMm;
    const amount =
      maximum === undefined
        ? 0
        : Math.floor(
            (Math.min(
              maximum,
              base
                ? Math.min(params.topEdgeMm ?? 0, params.bottomEdgeMm ?? 0)
                : (params.textEdgeMm ?? 0),
            ) +
              1e-8) /
              EDGE_FINISH_GRID_MM,
          ) * EDGE_FINISH_GRID_MM;
    const isFontChange = !base && (controlKey === 'fontId' || controlKey === 'subtitleFontId');
    if (amount >= EDGE_FINISH_GRID_MM)
      add(
        'smaller-edge',
        base
          ? 'recoveryApplySmallerBaseEdge'
          : isFontChange
            ? 'recoveryTextEdgeFont'
            : 'recoveryApplySmallerTextEdge',
        base ? { topEdgeMm: amount, bottomEdgeMm: amount } : { textEdgeMm: amount },
        { amount: Number(amount.toFixed(1)), font: font.name },
      );
    add(
      'sharp-edge',
      base
        ? 'recoveryApplySharpBase'
        : isFontChange
          ? 'recoverySharpFont'
          : 'recoveryApplySharpText',
      base
        ? { edgeFinish: 'sharp', topEdgeMm: 0, bottomEdgeMm: 0 }
        : { textEdgeFinish: 'sharp', textEdgeMm: 0 },
      { font: font.name },
    );
  } else if (strategy === 'size') {
    const choices =
      simpleOptionGroups(params).find((group) => group.id === 'textSizeMm')?.choices ?? [];
    const sizes = choices
      .map((choice) => choice.changes.textSizeMm)
      .filter((value): value is number => value !== undefined && value < params.textSizeMm)
      .sort((a, b) => b - a);
    for (const value of sizes.slice(0, 2))
      add(`size-${value}`, 'recoveryApplySmallerText', { textSizeMm: value }, { size: value });
  } else if (strategy === 'connectivity') {
    const groups = simpleOptionGroups(params);
    const weights =
      groups
        .find((group) => group.id === 'fontWeightMm')
        ?.choices.map((choice) => choice.changes.fontWeightMm)
        .filter((value): value is number => value !== undefined && value > params.fontWeightMm)
        .sort((a, b) => a - b) ?? [];
    const spacings =
      groups
        .find((group) => group.id === 'letterSpacingMm')
        ?.choices.map((choice) => choice.changes.letterSpacingMm)
        .filter((value): value is number => value !== undefined && value < params.letterSpacingMm)
        .sort((a, b) => b - a) ?? [];
    if (weights[0] !== undefined)
      add('weight', 'recoveryApplyWeight', { fontWeightMm: weights[0] });
    if (spacings[0] !== undefined)
      add('spacing', 'recoveryApplySpacing', { letterSpacingMm: spacings[0] });
  } else if (strategy === 'font' || strategy === 'geometry') {
    const secondary = controlKey === 'subtitleFontId' || failure.code.startsWith('subtitle-');
    const text = secondary ? (params.subtitle ?? '') : params.text;
    const fallback = FONT_CATALOG.find(
      (candidate) =>
        candidate.id !== (secondary ? params.subtitleFontId : params.fontId) &&
        (params.templateId === 'articulated-name'
          ? fontSupportsArticulatedName(candidate, text)
          : fontSupportsText(candidate, text)),
    );
    if (fallback)
      add(
        'font',
        'recoveryApplyFont',
        secondary ? { subtitleFontId: fallback.id } : { fontId: fallback.id },
        { font: fallback.name },
      );
  } else if (strategy === 'retry') add('retry', 'recoveryRetry', {});
  return recipes.slice(0, 2);
};

/** Snapshot metadata independently from mutable provider records; bytes are checked by identity too. */
export const recoveryFontSignature = (font: FontDefinition): string =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(font)
        .filter(([key]) => key !== 'data')
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
