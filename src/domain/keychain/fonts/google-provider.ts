import type { FontCategory, FontDefinition, FontScript } from './catalog';

export type GoogleFontRecord = {
  family: string;
  variants?: readonly string[];
  subsets?: readonly string[];
  files?: Readonly<Record<string, string>>;
};
const GOOGLE_FONT_HOSTS = new Set(['fonts.gstatic.com', 'fonts.googleapis.com']);
const isAllowedFontUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      GOOGLE_FONT_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
};

export type GoogleFontProviderOptions = {
  allowlist?: ReadonlySet<string> | readonly string[];
  maxFonts?: number;
  cacheTtlMs?: number;
  now?: () => number;
  fetch?: typeof globalThis.fetch;
  apiKey?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export type GoogleFontProviderErrorCode =
  'missing-api-key' | 'network' | 'timeout' | 'http' | 'payload-too-large' | 'invalid-payload';

/** An actionable error from the remote Google Fonts provider. */
export class GoogleFontProviderError extends Error {
  readonly code: GoogleFontProviderErrorCode;
  readonly status?: number;

  constructor(code: GoogleFontProviderErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'GoogleFontProviderError';
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_MAX_FONTS = 500;
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const STORAGE_KEY_PREFIX = 'open-keychain:google-fonts:v2';
const LEGACY_STORAGE_KEY = 'open-keychain:google-fonts:v1';
const WEIGHT_PREFERENCE = [700, 600, 500, 400];

const FONT_CATEGORIES: ReadonlySet<FontCategory> = new Set([
  'Rounded',
  'Geometric',
  'Chunky',
  'Condensed',
  'Serif',
  'Playful',
  'Decorative',
  'Handwritten',
  'Calligraphic',
  'Marker',
]);
const FONT_SCRIPTS: ReadonlySet<FontScript> = new Set(['latin', 'cyrillic']);

const isFontDefinition = (value: unknown): value is FontDefinition => {
  if (!value || typeof value !== 'object') return false;
  const font = value as Partial<FontDefinition>;
  return (
    typeof font.id === 'string' &&
    font.id.length > 0 &&
    typeof font.name === 'string' &&
    font.name.length > 0 &&
    typeof font.file === 'string' &&
    isAllowedFontUrl(font.file) &&
    typeof font.previewFamily === 'string' &&
    font.previewFamily.length > 0 &&
    typeof font.weight === 'number' &&
    Number.isFinite(font.weight) &&
    font.weight >= 100 &&
    font.weight <= 1000 &&
    FONT_CATEGORIES.has(font.category as FontCategory) &&
    Array.isArray(font.scripts) &&
    font.scripts.length > 0 &&
    font.scripts.every((script) => FONT_SCRIPTS.has(script as FontScript)) &&
    typeof font.supportsArticulated === 'boolean' &&
    typeof font.sampleLatin === 'string' &&
    typeof font.sampleCyrillic === 'string' &&
    font.source === 'google' &&
    font.provider === 'google-fonts' &&
    (font.articulatedDilationMm === undefined ||
      (typeof font.articulatedDilationMm === 'number' &&
        Number.isFinite(font.articulatedDilationMm))) &&
    (font.minimumCyrillicWeightMm === undefined ||
      (typeof font.minimumCyrillicWeightMm === 'number' &&
        Number.isFinite(font.minimumCyrillicWeightMm))) &&
    (font.minimumFittedTextHeightMm === undefined ||
      (typeof font.minimumFittedTextHeightMm === 'number' &&
        Number.isFinite(font.minimumFittedTextHeightMm))) &&
    (font.specimenUrl === undefined || typeof font.specimenUrl === 'string') &&
    (font.licenseUrl === undefined || typeof font.licenseUrl === 'string')
  );
};

const cacheKeyFor = (allowlist: ReadonlySet<string> | undefined, maxFonts: number): string => {
  const config = JSON.stringify({
    allowlist: allowlist ? [...allowlist].sort() : null,
    maxFonts,
  });
  let hash = 2166136261;
  for (let index = 0; index < config.length; index += 1) {
    hash ^= config.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${STORAGE_KEY_PREFIX}:${(hash >>> 0).toString(16)}`;
};

const slug = (family: string): string =>
  family
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const categoryFor = (family: string): FontCategory => {
  const name = family.toLowerCase();
  if (/serif|slab|merriweather|roboto.?slab/.test(name)) return 'Serif';
  if (/script|hand|caveat|kalam|lobster|pacifico|cursive/.test(name)) return 'Handwritten';
  if (/rounded|nunito|quicksand|comfortaa/.test(name)) return 'Rounded';
  if (/condensed|oswald|bebas/.test(name)) return 'Condensed';
  if (/display|chunk|fredoka|baloo/.test(name)) return 'Chunky';
  return 'Geometric';
};

const hasCyrillic = (subsets: readonly string[]): boolean =>
  subsets.some((subset) => subset.toLowerCase() === 'cyrillic');

export const selectGoogleVariant = (
  variants: readonly string[] = [],
  preferredWeight = 700,
): { variant: string; weight: number } | null => {
  const candidates = variants
    .filter((variant): variant is string => typeof variant === 'string')
    .filter((variant) => !variant.toLowerCase().includes('italic'))
    .map((variant) => ({
      variant,
      weight: variant === 'regular' ? 400 : Number.parseInt(variant, 10),
    }))
    .filter(({ weight }) => Number.isFinite(weight) && weight >= 100 && weight <= 1000);
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      Math.abs(a.weight - preferredWeight) - Math.abs(b.weight - preferredWeight) ||
      WEIGHT_PREFERENCE.indexOf(b.weight) - WEIGHT_PREFERENCE.indexOf(a.weight) ||
      a.variant.localeCompare(b.variant),
  );
  return candidates[0];
};

export const normalizeGoogleFont = (
  record: GoogleFontRecord,
  options: { preferredWeight?: number } = {},
): FontDefinition | null => {
  if (!record || typeof record !== 'object' || typeof record.family !== 'string') return null;
  const family = record.family.trim();
  if (!family || !Array.isArray(record.variants)) return null;
  const selected = selectGoogleVariant(record.variants, options.preferredWeight ?? 700);
  if (!selected) return null;
  const files = record.files && typeof record.files === 'object' ? record.files : undefined;
  const file = files?.[String(selected.weight)] ?? files?.[selected.variant];
  if (typeof file !== 'string' || !isAllowedFontUrl(file)) return null;
  const subsets = Array.isArray(record.subsets)
    ? record.subsets.filter((subset): subset is string => typeof subset === 'string')
    : [];
  const scripts: readonly FontScript[] = hasCyrillic(subsets) ? ['latin', 'cyrillic'] : ['latin'];
  return {
    id: `google-${slug(family)}`,
    name: family,
    file,
    previewFamily: `Google${slug(family).replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`,
    weight: selected.weight,
    category: categoryFor(family),
    scripts,
    supportsArticulated: false,
    sampleLatin: 'ALEX',
    sampleCyrillic: 'АБВГ',
    source: 'google',
    provider: 'google-fonts',
    specimenUrl: `https://fonts.google.com/specimen/${encodeURIComponent(family)}`,
  };
};

export const createGoogleFontProvider = (options: GoogleFontProviderOptions) => {
  const allowlist = options.allowlist ? new Set(options.allowlist) : undefined;
  const maxFonts = Number.isFinite(options.maxFonts)
    ? Math.max(0, Math.floor(options.maxFonts as number))
    : DEFAULT_MAX_FONTS;
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs)
    ? Math.max(0, options.cacheTtlMs as number)
    : DEFAULT_CACHE_TTL_MS;
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.max(0, options.timeoutMs as number)
    : 8000;
  const maxResponseBytes = Number.isFinite(options.maxResponseBytes)
    ? Math.max(0, options.maxResponseBytes as number)
    : 2_000_000;
  const storageKey = cacheKeyFor(allowlist, maxFonts);
  const now = options.now ?? Date.now;
  const fetcher = options.fetch ?? globalThis.fetch;
  let cached: { expiresAt: number; fonts: FontDefinition[] } | undefined;
  const readStored = (): typeof cached => {
    try {
      const raw = globalThis.sessionStorage?.getItem(storageKey);
      if (!raw) return undefined;
      const value = JSON.parse(raw) as typeof cached;
      return value &&
        Number.isFinite(value.expiresAt) &&
        value.expiresAt > now() &&
        Array.isArray(value.fonts) &&
        value.fonts.every(isFontDefinition)
        ? value
        : undefined;
    } catch {
      return undefined;
    }
  };
  const writeStored = (value: NonNullable<typeof cached>): void => {
    try {
      globalThis.sessionStorage?.setItem(storageKey, JSON.stringify(value));
    } catch {
      return;
    }
  };

  return {
    async list(): Promise<FontDefinition[]> {
      if (cached && cached.expiresAt > now()) return cached.fonts;
      cached = readStored();
      if (cached) return cached.fonts;
      if (!fetcher)
        throw new GoogleFontProviderError('network', 'Google font provider requires fetch.');
      if (!options.apiKey)
        throw new GoogleFontProviderError(
          'missing-api-key',
          'Google Fonts API key is not configured.',
        );
      const url = new URL('https://www.googleapis.com/webfonts/v1/webfonts');
      url.searchParams.set('key', options.apiKey);
      const controller = new AbortController();
      let rejectTimeout: (reason: GoogleFontProviderError) => void = () => undefined;
      const timedOut = new Promise<never>((_, reject) => {
        rejectTimeout = reject;
      });
      const timeout = setTimeout(() => {
        controller.abort();
        rejectTimeout(new GoogleFontProviderError('timeout', 'Google Fonts request timed out.'));
      }, timeoutMs);
      let response: Response;
      try {
        response = await Promise.race([fetcher(url, { signal: controller.signal }), timedOut]);
      } catch (error) {
        if (controller.signal.aborted) {
          throw new GoogleFontProviderError('timeout', 'Google Fonts request timed out.');
        }
        const detail = error instanceof Error ? `: ${error.message}` : '';
        throw new GoogleFontProviderError('network', `Google Fonts request failed${detail}`);
      }
      try {
        if (!response.ok)
          throw new GoogleFontProviderError(
            'http',
            `Google Fonts request failed (${response.status})`,
            response.status,
          );
        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > maxResponseBytes)
          throw new GoogleFontProviderError(
            'payload-too-large',
            'Google Fonts response is too large.',
          );

        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        if (reader) {
          try {
            for (;;) {
              const { done, value } = await Promise.race([reader.read(), timedOut]);
              if (done) break;
              if (!value) continue;
              length += value.byteLength;
              if (length > maxResponseBytes) {
                void reader.cancel().catch(() => undefined);
                throw new GoogleFontProviderError(
                  'payload-too-large',
                  'Google Fonts response is too large.',
                );
              }
              chunks.push(value);
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          const body = await Promise.race([response.arrayBuffer(), timedOut]);
          if (body.byteLength > maxResponseBytes)
            throw new GoogleFontProviderError(
              'payload-too-large',
              'Google Fonts response is too large.',
            );
          chunks.push(new Uint8Array(body));
          length = body.byteLength;
        }

        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.byteLength;
        }
        let payload: { items?: unknown };
        try {
          payload = JSON.parse(new TextDecoder().decode(body)) as { items?: unknown };
        } catch {
          throw new GoogleFontProviderError(
            'invalid-payload',
            'Google Fonts response is not valid JSON.',
          );
        }
        if (!payload || !Array.isArray(payload.items))
          throw new GoogleFontProviderError(
            'invalid-payload',
            'Google Fonts response has no font list.',
          );
        const fonts = (payload.items as GoogleFontRecord[])
          .filter((font): font is GoogleFontRecord => Boolean(font && typeof font === 'object'))
          .filter(
            (font): font is GoogleFontRecord & { family: string } =>
              typeof font.family === 'string',
          )
          .filter((font) => !allowlist || allowlist.has(font.family))
          .sort((a, b) => a.family.localeCompare(b.family) || (a.family < b.family ? -1 : 1))
          .slice(0, maxFonts)
          .map((font) => normalizeGoogleFont(font))
          .filter((font): font is FontDefinition => font !== null);
        cached = { expiresAt: now() + cacheTtlMs, fonts };
        writeStored(cached);
        return fonts;
      } catch (error) {
        if (error instanceof GoogleFontProviderError) throw error;
        if (controller.signal.aborted)
          throw new GoogleFontProviderError('timeout', 'Google Fonts request timed out.');
        const detail = error instanceof Error ? `: ${error.message}` : '';
        throw new GoogleFontProviderError(
          'network',
          `Could not read Google Fonts response${detail}`,
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    clearCache(): void {
      cached = undefined;
      try {
        globalThis.sessionStorage?.removeItem(storageKey);
        globalThis.sessionStorage?.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        return;
      }
    },
  };
};
