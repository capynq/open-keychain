import type { PhotoFormat } from './photo-format';

export type PhotoCaptureApi = {
  maxTextureSize: number;
  capture: (longEdge: number, format?: PhotoFormat) => Promise<Blob>;
};
