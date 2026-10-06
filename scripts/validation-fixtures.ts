import type { KeyringPosition } from '../src/domain/keychain/model/keyring-position';
import type { KeychainParams } from '../src/domain/keychain/model/types';

import { KEYRING_POSITIONS } from '../src/domain/keychain/model/keyring-position';

export type ValidationFixture = {
  id: string;
  params: Pick<KeychainParams, 'templateId' | 'styleId' | 'fontId' | 'text'> &
    Partial<
      Pick<
        KeychainParams,
        | 'edgeFinish'
        | 'topEdgeMm'
        | 'bottomEdgeMm'
        | 'textEdgeFinish'
        | 'textEdgeMm'
        | 'keyringPreset'
        | 'keyringPosition'
        | 'keyringOpeningShape'
        | 'holeDiameterMm'
        | 'keyringSlotLengthMm'
      >
    >;
};

const KEYRING_POSITION_FIXTURES: ValidationFixture[] = KEYRING_POSITIONS.flatMap(
  (keyringPosition: KeyringPosition) =>
    (['name-keychain', 'articulated-name'] as const).map((templateId) => ({
      id: `${templateId === 'name-keychain' ? 'nk' : 'art'}-oval-${keyringPosition}`,
      params: {
        templateId,
        styleId: 'contour' as const,
        fontId: templateId === 'name-keychain' ? 'nunito' : 'bungee',
        text: 'ALEX',
        keyringPosition,
        keyringPreset: 'oval-slot' as const,
        keyringOpeningShape: 'slot' as const,
        holeDiameterMm: 4,
        keyringSlotLengthMm: 8,
      },
    })),
);

export const VALIDATION_FIXTURES: ValidationFixture[] = [
  ...KEYRING_POSITION_FIXTURES,
  {
    id: 'nk-front-chamfer',
    params: {
      templateId: 'name-keychain',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'ALEX',
      textEdgeFinish: 'chamfer',
      textEdgeMm: 0.6,
    },
  },
  {
    id: 'nk-front-round',
    params: {
      templateId: 'name-keychain',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'BOO',
      textEdgeFinish: 'round',
      textEdgeMm: 0.2,
    },
  },
  {
    id: 'nk-base-chamfer-front-round',
    params: {
      templateId: 'name-keychain',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'ALEX',
      edgeFinish: 'chamfer',
      topEdgeMm: 0.2,
      bottomEdgeMm: 0.2,
      textEdgeFinish: 'round',
      textEdgeMm: 0.2,
    },
  },
  {
    id: 'plate-front-round',
    params: {
      templateId: 'nameplate',
      styleId: 'contour',
      fontId: 'nunito',
      text: 'BOO',
      textEdgeFinish: 'round',
      textEdgeMm: 0.2,
    },
  },
  {
    id: 'nk-contour-latin',
    params: { templateId: 'name-keychain', styleId: 'contour', fontId: 'nunito', text: 'ALEX' },
  },
  {
    id: 'nk-capsule-cyrillic',
    params: { templateId: 'name-keychain', styleId: 'capsule', fontId: 'rubik', text: 'НИКИТА' },
  },
  {
    id: 'nk-soft-narrow',
    params: {
      templateId: 'name-keychain',
      styleId: 'soft-tag',
      fontId: 'pangolin',
      text: 'IIIIIIII',
    },
  },
  {
    id: 'nk-bubble-wide',
    params: { templateId: 'name-keychain', styleId: 'bubble', fontId: 'montserrat', text: 'WWWW' },
  },
  {
    id: 'nk-arch-descenders',
    params: { templateId: 'name-keychain', styleId: 'arch', fontId: 'playpen-sans', text: 'iJj' },
  },
  {
    id: 'art-latin',
    params: { templateId: 'articulated-name', styleId: 'contour', fontId: 'bungee', text: 'ALEX' },
  },
  {
    id: 'art-cyrillic',
    params: { templateId: 'articulated-name', styleId: 'contour', fontId: 'rubik', text: 'НИКИТА' },
  },
  {
    id: 'plate-long',
    params: {
      templateId: 'nameplate',
      styleId: 'contour',
      fontId: 'montserrat',
      text: 'MAXIMILIAN',
    },
  },
  {
    id: 'plant-latin',
    params: { templateId: 'plant-label', styleId: 'contour', fontId: 'nunito', text: 'BASIL' },
  },
  {
    id: 'plant-cyrillic',
    params: { templateId: 'plant-label', styleId: 'capsule', fontId: 'pangolin', text: 'МЯТА' },
  },
];
