export const PHOTO_FORMATS = ['png', 'jpg'] as const;

export type PhotoFormat = (typeof PHOTO_FORMATS)[number];

export const PHOTO_FORMAT_MIME: Record<PhotoFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
};
