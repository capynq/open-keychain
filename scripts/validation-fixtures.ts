import type { KeychainParams } from '../src/domain/keychain/model/types';

export type ValidationFixture = {
  id: string;
  params: Pick<KeychainParams, 'templateId' | 'styleId' | 'fontId' | 'text'>;
};

export const VALIDATION_FIXTURES: ValidationFixture[] = [
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
