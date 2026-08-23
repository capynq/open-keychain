import type { CrossSection } from '../../../infrastructure/geometry/manifold-types';
import type { MagnetPocketMetadata } from '../model/types';

export type StandardStyledGeometry = {
  kind: 'standard';
  scale: number;
  rawText: CrossSection;
  relief: CrossSection;
  subtitle?: CrossSection;
  backing: CrossSection;
  recesses: Array<{ section: CrossSection; depthMm: number }>;
  rearRecesses: Array<{ section: CrossSection; depthMm: number }>;
  magnetPocket?: MagnetPocketMetadata;
  reliefDepthMm?: number;
  widthMm: number;
};
