export type FontDefinition = {
  id: string;
  name: string;
  file: string;
  weight: number;
  category: string;
  scripts: readonly FontScript[];
  sampleLatin: string;
  sampleCyrillic: string;
};

export type FontScript = 'latin' | 'cyrillic';

const latin: readonly FontScript[] = ['latin'];
const latinCyrillic: readonly FontScript[] = ['latin', 'cyrillic'];

export const FONT_CATALOG: FontDefinition[] = [
  { id: 'nunito', name: 'Nunito', file: '/fonts/nunito.ttf', weight: 700, category: 'Rounded', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'quicksand', name: 'Quicksand', file: '/fonts/quicksand.ttf', weight: 700, category: 'Geometric', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'fredoka', name: 'Fredoka', file: '/fonts/fredoka.ttf', weight: 600, category: 'Chunky', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'oswald', name: 'Oswald', file: '/fonts/oswald.ttf', weight: 600, category: 'Condensed', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'bree-serif', name: 'Bree Serif', file: '/fonts/bree-serif.ttf', weight: 400, category: 'Serif', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'baloo2', name: 'Baloo 2', file: '/fonts/baloo2.ttf', weight: 600, category: 'Playful', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'kalam', name: 'Kalam', file: '/fonts/kalam.ttf', weight: 700, category: 'Handwritten', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'bungee', name: 'Bungee', file: '/fonts/bungee.ttf', weight: 400, category: 'Decorative', scripts: latin, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'caveat', name: 'Caveat', file: '/fonts/caveat.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'marck-script', name: 'Marck Script', file: '/fonts/marck-script.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'bad-script', name: 'Bad Script', file: '/fonts/bad-script.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'neucha', name: 'Neucha', file: '/fonts/neucha.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'amatic-sc', name: 'Amatic SC', file: '/fonts/amatic-sc.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'lobster', name: 'Lobster', file: '/fonts/lobster.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
  { id: 'pangolin', name: 'Pangolin', file: '/fonts/pangolin.ttf', weight: 400, category: 'Calligraphic', scripts: latinCyrillic, sampleLatin: 'ALEX', sampleCyrillic: 'АБВГ' },
];

export const FONT_BY_ID = new Map(FONT_CATALOG.map((font) => [font.id, font]));

export function fontDefinition(id: string): FontDefinition {
  return FONT_BY_ID.get(id) ?? FONT_CATALOG[0];
}

export function textUsesCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text);
}

export function fontSupportsText(font: FontDefinition, text: string): boolean {
  return !textUsesCyrillic(text) || font.scripts.includes('cyrillic');
}
