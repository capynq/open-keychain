import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS } from '@/domain/keychain/model/types';

import { createWebMcpTools } from './tools';

const state = {
  template: 'Name keychain',
  style: 'Plain',
  font: 'Bungee',
  printable: true,
  busy: false,
  error: undefined,
  dimensions: { widthMm: 60, heightMm: 20, thicknessMm: 4 },
};

describe('WebMCP customizer tools', () => {
  it('reports current design and preview state through a read-only tool', () => {
    const tools = createWebMcpTools(
      { params: { ...DEFAULT_PARAMS, text: 'ALEX', subtitle: 'MAKER' }, applyDesign: vi.fn() },
      state,
    );

    expect(tools.map((tool) => tool.name)).toEqual(['get-keychain-state', 'customize-keychain']);
    expect(tools[0].annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true });
    expect(tools[0].inputSchema.additionalProperties).toBe(false);
    expect(tools[0].execute({ text: 'ALEX' })).toMatchObject({
      text: 'ALEX',
      subtitle: 'MAKER',
      template: 'Name keychain',
      preview: { printable: true, dimensions: state.dimensions },
    });
  });

  it('normalizes valid text while preserving omitted fields', () => {
    const applyDesign = vi.fn();
    const tools = createWebMcpTools({ params: DEFAULT_PARAMS, applyDesign }, state);
    const input = { text: '  MIRA   LEE  ', template: 'nameplate' as const };

    expect(tools[1].execute(input)).toEqual({
      applied: { text: 'MIRA LEE', templateId: 'nameplate' },
    });
    expect(applyDesign).toHaveBeenCalledWith({
      text: 'MIRA LEE',
      templateId: 'nameplate',
    });
  });

  it('allows an empty subtitle to clear existing subtitle text', () => {
    const applyDesign = vi.fn();
    const tools = createWebMcpTools(
      { params: { ...DEFAULT_PARAMS, subtitle: 'MAKER' }, applyDesign },
      state,
    );

    expect(tools[1].execute({ text: 'MIRA', subtitle: '' })).toEqual({
      applied: { text: 'MIRA', subtitle: '' },
    });
    expect(applyDesign).toHaveBeenCalledWith({ text: 'MIRA', subtitle: '' });
  });

  it('rejects empty, oversized, incompatible, and unknown changes', () => {
    const tools = createWebMcpTools({ params: DEFAULT_PARAMS, applyDesign: vi.fn() }, state);
    expect(() => tools[1].execute({ text: '   ' })).toThrow('1-24 characters');
    expect(() => tools[1].execute({ text: 'x'.repeat(25) })).toThrow('1-24 characters');
    expect(() => tools[1].execute({ text: 'MIRA', template: 'nope' as never })).toThrow(
      'Unknown template',
    );
    expect(() =>
      tools[1].execute({ text: 'MIRA', template: 'articulated-name', subtitle: 'tag' }),
    ).toThrow('do not support subtitles');
  });

  it('publishes bounded schemas and explicit safety annotations', () => {
    const tools = createWebMcpTools({ params: DEFAULT_PARAMS, applyDesign: vi.fn() }, state);
    const customize = tools[1];

    expect(customize.annotations).toEqual({ untrustedContentHint: true });
    expect(customize.inputSchema.additionalProperties).toBe(false);
    expect(customize.inputSchema.required).toEqual(['text']);
    expect(customize.inputSchema.properties.text).toMatchObject({ type: 'string', maxLength: 24 });
    expect(customize.inputSchema.properties.subtitle).toMatchObject({
      type: 'string',
      maxLength: 24,
    });
  });
});
