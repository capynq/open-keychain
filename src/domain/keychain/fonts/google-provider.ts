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
    return url.protocol === 'https:' && GOOGLE_FONT_HOSTS.has(url.hostname);
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

const DEFAULT_MAX_FONTS = 500;
const DEFAULT_CACHE_TTL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'open-keychain:google-fonts:v1';
const WEIGHT_PREFERENCE = [700, 600, 500, 400];

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
  if (!record.family?.trim()) return null;
  const selected = selectGoogleVariant(record.variants, options.preferredWeight ?? 700);
  if (!selected) return null;
  const file = record.files?.[String(selected.weight)] ?? record.files?.[selected.variant];
  if (!file || !isAllowedFontUrl(file)) return null;
  const scripts: readonly FontScript[] = hasCyrillic(record.subsets ?? [])
    ? ['latin', 'cyrillic']
    : ['latin'];
  return {
    id: `google-${slug(record.family)}`,
    name: record.family,
    file,
    previewFamily: `Google${slug(record.family).replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`,
    weight: selected.weight,
    category: categoryFor(record.family),
    scripts,
    supportsArticulated: false,
    sampleLatin: 'ALEX',
    sampleCyrillic: 'АБВГ',
    source: 'google',
    provider: 'google-fonts',
    specimenUrl: `https://fonts.google.com/specimen/${encodeURIComponent(record.family)}`,
  };
};

export const createGoogleFontProvider = (options: GoogleFontProviderOptions) => {
  const allowlist = options.allowlist ? new Set(options.allowlist) : undefined;
  const maxFonts = Math.max(0, Math.floor(options.maxFonts ?? DEFAULT_MAX_FONTS));
  const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  const now = options.now ?? Date.now;
  const fetcher = options.fetch ?? globalThis.fetch;
  let cached: { expiresAt: number; fonts: FontDefinition[] } | undefined;
  const readStored = (): typeof cached => {
    try {
      const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      const value = JSON.parse(raw) as typeof cached;
      return value?.expiresAt && value.expiresAt > now() ? value : undefined;
    } catch {
      return undefined;
    }
  };
  const writeStored = (value: NonNullable<typeof cached>): void => {
    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      return;
    }
  };

  return {
    async list(): Promise<FontDefinition[]> {
      if (cached && cached.expiresAt > now()) return cached.fonts;
      cached = readStored();
      if (cached) return cached.fonts;
      if (!fetcher) throw new Error('Google font provider requires fetch');
      if (!options.apiKey) throw new Error('Google Fonts API key is not configured.');
      const url = new URL('https://www.googleapis.com/webfonts/v1/webfonts');
      url.searchParams.set('key', options.apiKey);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
      let response: Response;
      try {
        response = await fetcher(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw new Error(`Google Fonts request failed (${response.status})`);
      const body = await response.arrayBuffer();
      if (body.byteLength > (options.maxResponseBytes ?? 2_000_000))
        throw new Error('Google Fonts response is too large.');
      const payload = JSON.parse(new TextDecoder().decode(body)) as { items?: GoogleFontRecord[] };
      const fonts = (payload.items ?? [])
        .filter((font) => !allowlist || allowlist.has(font.family))
        .sort((a, b) => a.family.localeCompare(b.family))
        .slice(0, maxFonts)
        .map((font) => normalizeGoogleFont(font))
        .filter((font): font is FontDefinition => font !== null);
      cached = { expiresAt: now() + cacheTtlMs, fonts };
      writeStored(cached);
      return fonts;
    },
    clearCache(): void {
      cached = undefined;
      try {
        globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      } catch {
        return;
      }
    },
  };
};
