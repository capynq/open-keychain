import type { CrossSection } from '../../../infrastructure/geometry/manifold-types';

export type StandardStyledGeometry = {
  kind: 'standard';
  scale: number;
  rawText: CrossSection;
  relief: CrossSection;
  backing: CrossSection;
  recesses: Array<{ section: CrossSection; depthMm: number }>;
  reliefDepthMm?: number;
  widthMm: number;
};
