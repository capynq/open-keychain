import {
  hasActiveParameter,
  PARAMETER_REGISTRY,
  PARAMETER_RANGES,
  parameterPresentationGroup,
  parameterRange,
  type ShapeParameter,
} from '../../../domain/keychain/model/parameters';
import { normalizeParams, type KeychainParams } from '../../../domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '../../../domain/keychain/templates/template-builder';

export type SimpleOptionIcon =
  | 'type'
  | 'bold'
  | 'spacing'
  | 'outline'
  | 'layers'
  | 'relief'
  | 'rotate'
  | 'stake'
  | 'motion'
  | 'bubble'
  | 'tag'
  | 'arch'
  | 'ribbon'
  | 'heart';

export type SimpleOption = {
  id: string;
  labelKey: string;
  descriptionKey: string;
  icon: SimpleOptionIcon;
  changes: Partial<KeychainParams>;
};

export type SimpleOptionGroup = {
  id: string;
  labelKey: string;
  presentation: 'typography' | 'shape' | 'template-details' | 'style-details' | 'print';
  candidateGroup: 'refine' | 'template-details' | 'style-details' | 'print';
  choices: readonly SimpleOption[];
};

type ChoiceTuple = readonly [label: string, value: number];
type GroupDefinition = {
  id: string;
  parameter?: ShapeParameter;
  labelKey: string;
  icon: SimpleOptionIcon;
  keyPrefix: string;
  entries: readonly ChoiceTuple[];
};

const numericGroup = (
  parameter: ShapeParameter,
  icon: SimpleOptionIcon,
  keyPrefix: string,
  entries: readonly ChoiceTuple[],
): GroupDefinition => ({
  id: parameter,
  parameter,
  labelKey: PARAMETER_REGISTRY[parameter].labelKey,
  icon,
  keyPrefix,
  entries,
});

const groups: readonly GroupDefinition[] = [
  numericGroup('textSizeMm', 'type', 'simpleTextSize', [
    ['Compact', 16],
    ['Balanced', 20],
    ['Generous', 26],
  ]),
  numericGroup('fontWeightMm', 'bold', 'simpleFontWeight', [
    ['Light', 0.2],
    ['Regular', 0.6],
    ['Bold', 1.1],
  ]),
  numericGroup('letterSpacingMm', 'spacing', 'simpleLetterSpacing', [
    ['Close', 0],
    ['Balanced', 1],
    ['Airy', 3],
  ]),
  numericGroup('edgeInsetMm', 'outline', 'simpleOutlineWidth', [
    ['Compact', 1.2],
    ['Balanced', 2.4],
    ['Generous', 3.4],
  ]),
  numericGroup('nameplateTiltDeg', 'rotate', 'simpleNameplateTilt', [
    ['Straight', 0],
    ['Slight', 6],
    ['Tilted', 18],
  ]),
  numericGroup('stakeLengthMm', 'stake', 'simpleStakeLength', [
    ['Compact', 32],
    ['Balanced', 48],
    ['Generous', 72],
  ]),
  numericGroup('maxJointAngleDeg', 'motion', 'simpleMotion', [
    ['Gentle', 20],
    ['Balanced', 35],
    ['Expressive', 45],
  ]),
  numericGroup('bubbleLobeMm', 'bubble', 'simpleBubbleLobe', [
    ['Compact', 1],
    ['Balanced', 2],
    ['Generous', 3],
  ]),
  numericGroup('tagTailMm', 'tag', 'simpleTagTail', [
    ['Compact', 1],
    ['Balanced', 2],
    ['Generous', 3],
  ]),
  numericGroup('archCurveMm', 'arch', 'simpleArchCurve', [
    ['Slight', 1.5],
    ['Balanced', 3],
    ['Generous', 5],
  ]),
  numericGroup('ribbonTailMm', 'ribbon', 'simpleRibbonTail', [
    ['Compact', 8],
    ['Balanced', 12],
    ['Generous', 20],
  ]),
  numericGroup('ribbonNotchMm', 'ribbon', 'simpleRibbonNotch', [
    ['Close', 2],
    ['Balanced', 4],
    ['Open', 8],
  ]),
  {
    id: 'heart-layout',
    labelKey: 'simpleHeartLayout',
    icon: 'heart',
    keyPrefix: 'simpleHeartLayout',
    entries: [
      ['Small', 16],
      ['Balanced', 22],
      ['Large', 28],
    ],
  },
  numericGroup('baseThicknessMm', 'layers', 'simpleBaseThickness', [
    ['Compact', 2],
    ['Balanced', 2.4],
    ['Generous', 3.6],
  ]),
  numericGroup('reliefDepthMm', 'relief', 'simpleReliefHeight', [
    ['Low', 0.8],
    ['Balanced', 1],
    ['High', 1.6],
  ]),
  {
    id: 'subtitleTextSizeMm',
    labelKey: 'simpleSubtitleSize',
    icon: 'type',
    keyPrefix: 'simpleSubtitle',
    entries: [
      ['Small', 5],
      ['Medium', 6],
      ['Large', 9],
    ],
  },
  {
    id: 'plantAccentEnabled',
    labelKey: 'simplePlantAccent',
    icon: 'stake',
    keyPrefix: 'simplePlantAccent',
    entries: [],
  },
];

const choiceFor = (group: GroupDefinition, label: string, value: number): SimpleOption => {
  const heart = group.id === 'heart-layout';
  const border = value === 16 ? 1.4 : value === 22 ? 1.6 : 2.4;
  return {
    id: `${group.id}-${label.toLowerCase()}`,
    labelKey: `${group.keyPrefix}${label}`,
    descriptionKey: `${group.keyPrefix}${label}Description`,
    icon: group.icon,
    changes: heart
      ? { heartSizeMm: value, heartBorderMm: border }
      : ({
          [group.parameter ?? (group.id as keyof KeychainParams)]: value,
        } as Partial<KeychainParams>),
  };
};

const choicesFor = (group: GroupDefinition, params: KeychainParams): readonly SimpleOption[] => {
  if (group.id === 'plantAccentEnabled')
    return [
      {
        id: 'off',
        labelKey: 'simplePlantAccentOff',
        descriptionKey: 'simplePlantAccentOffDescription',
        icon: 'tag',
        changes: { plantAccentEnabled: false },
      },
      {
        id: 'on',
        labelKey: 'simplePlantAccentOn',
        descriptionKey: 'simplePlantAccentOnDescription',
        icon: 'stake',
        changes: { plantAccentEnabled: true },
      },
    ];
  if (group.id === 'baseThicknessMm' && params.templateId === 'magnet')
    return [4.4, 4.7, 5].map((value, index) =>
      choiceFor(group, ['Structural', 'Reinforced', 'Maximal'][index], value),
    );
  if (group.id === 'baseThicknessMm' && params.templateId === 'articulated-name')
    return [3.4, 3.7, 4].map((value, index) =>
      choiceFor(group, ['Structural', 'Reinforced', 'Maximal'][index], value),
    );
  return group.entries.map(([label, value]) => choiceFor(group, label, value));
};

const choiceIsApplicable = (params: KeychainParams, choice: SimpleOption): boolean => {
  const entries = Object.entries(choice.changes) as [keyof KeychainParams, unknown][];
  const shapeEntries = entries.filter(([key]) => key in PARAMETER_RANGES) as [
    ShapeParameter,
    number,
  ][];
  if (shapeEntries.some(([parameter]) => !hasActiveParameter(params, parameter))) return false;
  try {
    const currentNormalized = normalizeParams(params);
    const normalized = normalizeParams({ ...params, ...choice.changes });
    const ownedKeys = new Set(Object.keys(choice.changes));
    const preservesUnownedValues = (Object.keys(params) as (keyof KeychainParams)[]).every(
      (key) =>
        ownedKeys.has(key) ||
        JSON.stringify(normalized[key]) === JSON.stringify(currentNormalized[key]),
    );
    return (
      shapeEntries.every(([parameter, value]) => {
        const range = parameterRange({ ...params, ...choice.changes }, parameter);
        return value >= range.min && value <= range.max && normalized[parameter] === value;
      }) &&
      entries.every(([key, value]) => normalized[key] === value) &&
      preservesUnownedValues
    );
  } catch {
    return false;
  }
};

export const simpleOptionGroups = (params: KeychainParams): SimpleOptionGroup[] =>
  groups
    .filter((group) => {
      if (group.id === 'subtitleTextSizeMm') {
        const template = TEMPLATE_CATALOG.find((item) => item.id === params.templateId);
        return Boolean(
          template?.supportsSubtitle && params.styleId !== 'heart-split' && params.subtitle.trim(),
        );
      }
      return group.id === 'plantAccentEnabled'
        ? hasActiveParameter(params, 'plantAccentEnabled')
        : true;
    })
    .map((group) => {
      const parameter =
        group.parameter ?? (group.id === 'heart-layout' ? 'heartSizeMm' : undefined);
      const candidateGroup = parameter
        ? parameterPresentationGroup(params, parameter)
        : group.id === 'plantAccentEnabled'
          ? 'template-details'
          : 'refine';
      const presentation = parameter
        ? ['textSizeMm', 'fontWeightMm', 'letterSpacingMm'].includes(parameter)
          ? 'typography'
          : candidateGroup === 'refine'
            ? 'shape'
            : candidateGroup
        : group.id === 'plantAccentEnabled'
          ? 'template-details'
          : 'typography';
      return {
        id: group.id,
        labelKey: group.labelKey,
        presentation,
        candidateGroup,
        choices: choicesFor(group, params).filter((choice) => choiceIsApplicable(params, choice)),
      } satisfies SimpleOptionGroup;
    })
    .filter((group) => group.choices.length > 0);

export const simpleOptionMatches = (
  params: KeychainParams,
  changes: Partial<KeychainParams>,
): boolean =>
  Object.entries(changes).every(([key, value]) => {
    const current = params[key as keyof KeychainParams];
    // Printer-grid normalization can turn 0.6 into 0.6000000000000001.
    return typeof current === 'number' && typeof value === 'number'
      ? Number.isFinite(current) && Number.isFinite(value) && Math.abs(current - value) <= 1e-9
      : current === value;
  });
