import { describe, expect, it } from 'vitest';

import {
  collectChunkCss,
  cssFilesDefining,
  cssModuleClassTokens,
  entryCss,
  findChunkByFacade,
  missingBootClasses,
  orderStylesheets,
  type BootBundle,
  type BootBundleChunk,
} from './boot-styles.ts';

const chunk = (
  fileName: string,
  options: Partial<Omit<BootBundleChunk, 'viteMetadata'>> & { css?: string[] } = {},
): BootBundleChunk => ({
  type: 'chunk',
  fileName,
  name: options.name ?? fileName,
  isEntry: options.isEntry ?? false,
  facadeModuleId: options.facadeModuleId ?? null,
  imports: options.imports ?? [],
  viteMetadata: { importedCss: new Set(options.css ?? []) },
});

const bundleOf = (...outputs: BootBundle[string][]): BootBundle =>
  Object.fromEntries(outputs.map((output) => [output.fileName, output]));

describe('collectChunkCss', () => {
  it('follows shared chunks that carry CSS modules, dependencies first', () => {
    const bundle = bundleOf(
      chunk('page.js', { imports: ['shared.js'], css: ['page.css'] }),
      chunk('shared.js', { imports: ['deep.js'], css: ['shared.css'] }),
      chunk('deep.js', { css: ['deep.css'] }),
    );
    expect(collectChunkCss(bundle, [bundle['page.js'] as BootBundleChunk])).toEqual([
      'deep.css',
      'shared.css',
      'page.css',
    ]);
  });

  it('keeps root order, visits a chunk once, and survives import cycles', () => {
    const bundle = bundleOf(
      chunk('page.js', { imports: ['a.js'], css: ['page.css'] }),
      chunk('a.js', { imports: ['page.js'], css: ['a.css'] }),
      chunk('viewer.js', { imports: ['a.js'], css: ['viewer.css'] }),
    );
    const roots = [bundle['page.js'], bundle['viewer.js']] as BootBundleChunk[];
    expect(collectChunkCss(bundle, roots)).toEqual(['a.css', 'page.css', 'viewer.css']);
  });

  it('skips CSS the entry already links and imports that are not chunks', () => {
    const bundle = bundleOf(
      chunk('page.js', { imports: ['app.js', 'missing.js'], css: ['page.css'] }),
      chunk('app.js', { css: ['app.css'] }),
    );
    expect(
      collectChunkCss(bundle, [bundle['page.js'] as BootBundleChunk], new Set(['app.css'])),
    ).toEqual(['page.css']);
  });
});

describe('orderStylesheets', () => {
  it('lists stylesheets in evaluation order across roots and cycles', () => {
    const imports = new Map([
      ['/src/main.tsx', ['/src/tokens.css', '/src/App.tsx']],
      ['/src/App.tsx', ['/src/app.css', '/src/Frame.tsx']],
      ['/src/Frame.tsx', ['/src/IconButton.module.css', '/src/App.tsx', '/src/frame.css']],
      ['/src/Viewer.tsx', ['/src/IconButton.module.css', '/src/viewer.css']],
    ]);
    expect(
      orderStylesheets(imports, ['/src/main.tsx', '/src/Frame.tsx', '/src/Viewer.tsx']),
    ).toEqual([
      '/src/tokens.css',
      '/src/app.css',
      '/src/IconButton.module.css',
      '/src/frame.css',
      '/src/viewer.css',
    ]);
  });
});

describe('entryCss', () => {
  it('collects the HTML entry graph and ignores other entries', () => {
    const bundle = bundleOf(
      chunk('app.js', {
        isEntry: true,
        facadeModuleId: '/root/index.html',
        imports: ['vendor.js'],
        css: ['app.css'],
      }),
      chunk('vendor.js', { css: ['vendor.css'] }),
      chunk('worker.js', { isEntry: true, facadeModuleId: '/root/worker.ts', css: ['w.css'] }),
    );
    expect([...entryCss(bundle)]).toEqual(['vendor.css', 'app.css']);
  });

  it('fails without an HTML entry', () => {
    expect(() => entryCss(bundleOf(chunk('a.js')))).toThrow('HTML entry');
  });
});

describe('findChunkByFacade', () => {
  it('returns the single chunk for a module and rejects missing or ambiguous ones', () => {
    const bundle = bundleOf(
      chunk('page.js', { facadeModuleId: '/root/Page.tsx' }),
      chunk('a.js', { facadeModuleId: '/root/Twice.tsx' }),
      chunk('b.js', { facadeModuleId: '/root/Twice.tsx' }),
    );
    expect(findChunkByFacade(bundle, '/root/Page.tsx').fileName).toBe('page.js');
    expect(() => findChunkByFacade(bundle, '/root/Missing.tsx')).toThrow('found 0');
    expect(() => findChunkByFacade(bundle, '/root/Twice.tsx')).toThrow('found 2');
  });
});

describe('boot class coverage', () => {
  const markup =
    '<button class="_root_xm8jp_1 _withLabel_xm8jp_5 icon-button"><span class="_label_xm8jp_12"></span></button>';

  it('reads only CSS-module class tokens from class attributes', () => {
    expect([...cssModuleClassTokens(markup)]).toEqual([
      '_root_xm8jp_1',
      '_withLabel_xm8jp_5',
      '_label_xm8jp_12',
    ]);
  });

  it('reports classes whose stylesheet is not linked', () => {
    expect(missingBootClasses(markup, ['._root_xm8jp_1{display:inline-grid}'])).toEqual([
      '_label_xm8jp_12',
      '_withLabel_xm8jp_5',
    ]);
  });

  it('does not accept a longer class name as a definition', () => {
    expect(missingBootClasses(markup, ['._root_xm8jp_10{}._withLabel_xm8jp_5-x{}'])).toEqual([
      '_label_xm8jp_12',
      '_root_xm8jp_1',
      '_withLabel_xm8jp_5',
    ]);
  });

  it('accepts compound and pseudo-class selectors as definitions', () => {
    expect(
      missingBootClasses(markup, [
        '._root_xm8jp_1._withLabel_xm8jp_5{display:inline-flex}._label_xm8jp_12:hover{}',
      ]),
    ).toEqual([]);
  });

  it('names the emitted stylesheet that defines a class', () => {
    const bundle: BootBundle = {
      'assets/FeedbackLine.css': {
        type: 'asset',
        fileName: 'assets/FeedbackLine.css',
        source: '._withLabel_xm8jp_5{display:inline-flex}',
      },
      'assets/other.css': { type: 'asset', fileName: 'assets/other.css', source: '.x{}' },
    };
    expect(cssFilesDefining(bundle, '_withLabel_xm8jp_5')).toEqual(['assets/FeedbackLine.css']);
  });
});
