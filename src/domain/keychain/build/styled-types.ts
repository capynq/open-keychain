import type { CrossSection } from '../../../infrastructure/geometry/manifold-types';
import type { GeometryParameterLimits, MagnetPocketMetadata } from '../model/types';
import type { KeyringOpening } from '../styles/style-builder';

export type StandardStyledGeometry = {
  kind: 'standard';
  parameterLimits?: GeometryParameterLimits;
  scale: number;
  rawText: CrossSection;
  relief: CrossSection;
  subtitle?: CrossSection;
  backing: CrossSection;
  recesses: Array<{ section: CrossSection; depthMm: number }>;
  rearRecesses: Array<{ section: CrossSection; depthMm: number }>;
  throughCuts?: CrossSection[];
  keyringOpening?: KeyringOpening;
  magnetPocket?: MagnetPocketMetadata;
  reliefDepthMm?: number;
  widthMm: number;
  heightMm: number;
};
