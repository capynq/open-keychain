export type PhotoCaptureApi = {
  maxTextureSize: number;
  capture: (longEdge: number) => Promise<Blob>;
};
