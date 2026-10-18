export const PHOTO_RESOLUTIONS = [1024, 2048, 4096] as const;

export type PhotoResolution = (typeof PHOTO_RESOLUTIONS)[number];

export const isPhotoResolutionSupported = (
  resolution: PhotoResolution,
  maxTextureSize: number | undefined,
): boolean => maxTextureSize !== undefined && resolution <= maxTextureSize;
