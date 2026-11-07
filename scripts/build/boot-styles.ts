/**
 * Stylesheet collection for the pre-React boot frames.
 *
 * A boot frame is server-rendered markup that the browser paints before the app entry runs, so
 * every stylesheet its classes need must be linked in the document itself. The set is derived
 * from the build graph instead of a hand-written list: shared chunks move as components gain new
 * importers, and a list keyed by chunk name silently misses the CSS that moves with them.
 */

export type BootBundleChunk = {
  type: 'chunk';
  fileName: string;
  name: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  imports: string[];
  viteMetadata?: { importedCss: Set<string> };
};
export type BootBundleAsset = { type: 'asset'; fileName: string; source: string | Uint8Array };
export type BootBundle = Record<string, BootBundleChunk | BootBundleAsset>;

const isChunk = (
  output: BootBundleChunk | BootBundleAsset | undefined,
): output is BootBundleChunk => output?.type === 'chunk';

/** The one chunk whose facade is `moduleId`; module ids are stable where chunk names are not. */
export const findChunkByFacade = (bundle: BootBundle, moduleId: string): BootBundleChunk => {
  const matches = Object.values(bundle).filter(
    (output): output is BootBundleChunk => isChunk(output) && output.facadeModuleId === moduleId,
  );
  if (matches.length !== 1)
    throw new Error(`Expected one chunk for ${moduleId}, found ${matches.length}.`);
  return matches[0];
};

/**
 * CSS files reachable through static imports, in the order Vite's preload helper links them:
 * a chunk's imports first, then its own CSS. Dynamic imports are never followed because the
 * runtime does not load them with the chunk either.
 */
export const collectChunkCss = (
  bundle: BootBundle,
  roots: BootBundleChunk[],
  exclude: ReadonlySet<string> = new Set(),
): string[] => {
  const visited = new Set<string>();
  const css = new Set<string>();
  const visit = (fileName: string) => {
    if (visited.has(fileName)) return;
    visited.add(fileName);
    const chunk = bundle[fileName];
    if (!isChunk(chunk)) return;
    chunk.imports.forEach(visit);
    for (const file of chunk.viteMetadata?.importedCss ?? []) if (!exclude.has(file)) css.add(file);
  };
  roots.forEach((root) => visit(root.fileName));
  return [...css];
};

/**
 * JavaScript chunks reachable through static imports from `roots`, each before its imports
 * (Vite's preload order). The entry graph is excluded because the HTML already preloads it.
 */
export const collectChunkFiles = (
  bundle: BootBundle,
  roots: BootBundleChunk[],
  exclude: ReadonlySet<string> = new Set(),
): string[] => {
  const files: string[] = [];
  const visited = new Set<string>();
  const visit = (fileName: string) => {
    if (visited.has(fileName) || exclude.has(fileName)) return;
    visited.add(fileName);
    const chunk = bundle[fileName];
    if (!isChunk(chunk)) return;
    files.push(chunk.fileName);
    chunk.imports.forEach(visit);
  };
  roots.forEach((root) => visit(root.fileName));
  return files;
};

const htmlEntries = (bundle: BootBundle): BootBundleChunk[] => {
  const entries = Object.values(bundle).filter(
    (output): output is BootBundleChunk =>
      isChunk(output) && output.isEntry && Boolean(output.facadeModuleId?.endsWith('.html')),
  );
  if (!entries.length) throw new Error('Expected an HTML entry chunk in the bundle.');
  return entries;
};

/** Chunks the HTML entry already loads, which boot documents must not preload again. */
export const entryChunks = (bundle: BootBundle): Set<string> =>
  new Set(collectChunkFiles(bundle, htmlEntries(bundle)));

/** CSS the HTML entry already links, which boot documents must not link a second time. */
export const entryCss = (bundle: BootBundle): Set<string> =>
  new Set(collectChunkCss(bundle, htmlEntries(bundle)));

/**
 * Stylesheets in module evaluation order (imports before importers, in source order), which is
 * the order the development server injects them in.
 */
export const orderStylesheets = (imports: ReadonlyMap<string, string[]>, roots: string[]) => {
  const visited = new Set<string>();
  const stylesheets: string[] = [];
  const visit = (url: string) => {
    if (visited.has(url)) return;
    visited.add(url);
    (imports.get(url) ?? []).forEach(visit);
    if (/\.css$/.test(url)) stylesheets.push(url);
  };
  roots.forEach(visit);
  return stylesheets;
};

/** Matches Vite's default CSS-module names: `_${local}_${hash}_${line}`. */
const CSS_MODULE_CLASS = /^_[A-Za-z][\w-]*_[a-z0-9]{5}_\d+$/;

export const cssModuleClassTokens = (markup: string): Set<string> =>
  new Set(
    [...markup.matchAll(/\sclass="([^"]*)"/g)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter((token) => CSS_MODULE_CLASS.test(token)),
  );

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/** CSS-module classes used in the boot markup that no linked stylesheet defines. */
export const missingBootClasses = (markup: string, stylesheets: string[]): string[] => {
  const css = stylesheets.join('\n');
  return [...cssModuleClassTokens(markup)]
    .filter((token) => !new RegExp(`\\.${escapeRegExp(token)}(?![\\w-])`).test(css))
    .sort();
};

/** Bundle CSS files whose source defines `token`, to name the stylesheet the boot frame lacks. */
export const cssFilesDefining = (bundle: BootBundle, token: string): string[] =>
  Object.values(bundle)
    .filter(
      (output): output is BootBundleAsset =>
        output.type === 'asset' &&
        output.fileName.endsWith('.css') &&
        String(output.source).includes(`.${token}`),
    )
    .map((asset) => asset.fileName);
