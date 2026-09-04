import type { KeychainParams } from '@/domain/keychain/model/types';

import { STYLE_CATALOG } from '@/domain/keychain/styles/style-builder';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';

export type WebMcpDesignInput = {
  text: string;
  subtitle?: string;
  template?: KeychainParams['templateId'];
  style?: KeychainParams['styleId'];
};
export type WebMcpCustomizer = {
  params: KeychainParams;
  applyDesign: (changes: WebMcpDesignInput) => void;
};
export type WebMcpState = {
  template: string;
  style: string | undefined;
  font: string;
  printable: boolean;
  busy: boolean;
  error: string | undefined;
  dimensions: { widthMm: number; heightMm: number; thicknessMm: number } | undefined;
};

const assertText = (value: string, label: string, allowEmpty = false): string => {
  const trimmed = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if ((!allowEmpty && !trimmed) || [...trimmed].length > 24)
    throw new Error(`${label} must be ${allowEmpty ? '0-24' : '1-24'} characters.`);
  return trimmed;
};

export const createWebMcpTools = (customizer: WebMcpCustomizer, state: WebMcpState) => [
  {
    name: 'get-keychain-state',
    title: 'Get keychain state',
    description: 'Read the current keychain text, template, style, and preview status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => ({
      text: customizer.params.text,
      subtitle: customizer.params.subtitle,
      templateId: customizer.params.templateId,
      styleId: customizer.params.styleId,
      template: state.template,
      style: state.style,
      font: state.font,
      preview: {
        busy: state.busy,
        printable: state.printable,
        error: state.error,
        dimensions: state.dimensions,
      },
    }),
  },
  {
    name: 'customize-keychain',
    title: 'Customize keychain',
    description: 'Set keychain text, subtitle, template, or style. Omitted fields stay unchanged.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          maxLength: 24,
          description: 'Required main text, up to 24 characters.',
        },
        subtitle: { type: 'string', maxLength: 24, description: 'Subtitle, up to 24 characters.' },
        template: {
          type: 'string',
          enum: ['name-keychain', 'articulated-name', 'nameplate', 'plant-label', 'magnet'],
          description: 'Template identifier for the keychain shape.',
        },
        style: {
          type: 'string',
          enum: ['plain', 'contour', 'capsule', 'soft-tag', 'bubble', 'arch', 'ribbon'],
          description: 'Compatible backing style identifier.',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    annotations: { untrustedContentHint: true },
    execute: (input: WebMcpDesignInput) => {
      const text = assertText(input.text, 'Text');
      const subtitle =
        input.subtitle === undefined ? undefined : assertText(input.subtitle, 'Subtitle', true);
      const template = input.template;
      const style = input.style;
      const effectiveTemplateId = template ?? customizer.params.templateId;
      const selectedTemplate = TEMPLATE_CATALOG.find((item) => item.id === effectiveTemplateId);
      if (!selectedTemplate) throw new Error('Unknown template.');
      if (style && !STYLE_CATALOG.some((item) => item.id === style))
        throw new Error('Unknown style.');
      if (style && !selectedTemplate.styles.includes(style))
        throw new Error('That style is not supported by the selected template.');
      if (effectiveTemplateId === 'articulated-name' && subtitle)
        throw new Error('Articulated keychains do not support subtitles.');
      const changes = {
        text,
        ...(subtitle === undefined ? {} : { subtitle }),
        ...(template === undefined ? {} : { templateId: template }),
        ...(style === undefined ? {} : { styleId: style }),
      };
      customizer.applyDesign(changes);
      return { applied: changes };
    },
  },
];
