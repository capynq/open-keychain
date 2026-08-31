import {
  buildTemplate,
  type TemplateBuild,
} from '../../../domain/keychain/templates/template-builder';
import type { StyleId, TemplateId } from '../../../domain/keychain/model/types';
import type { StyleInput } from '../../../domain/keychain/styles/style-builder';
import type { GeometryWasm } from '../../../infrastructure/geometry/manifold-types';

export type TemplateBuilder = (
  wasm: GeometryWasm,
  styleId: StyleId,
  input: StyleInput,
) => TemplateBuild;

export const TEMPLATE_BUILDERS: Readonly<Record<TemplateId, TemplateBuilder>> = {
  'name-keychain': (wasm, styleId, input) => buildTemplate(wasm, 'name-keychain', styleId, input),
  'articulated-name': (wasm, styleId, input) =>
    buildTemplate(wasm, 'articulated-name', styleId, input),
  magnet: (wasm, styleId, input) => buildTemplate(wasm, 'magnet', styleId, input),
  nameplate: (wasm, styleId, input) => buildTemplate(wasm, 'nameplate', styleId, input),
  'plant-label': (wasm, styleId, input) => buildTemplate(wasm, 'plant-label', styleId, input),
};

export const buildRegisteredTemplate = (
  wasm: GeometryWasm,
  templateId: TemplateId,
  styleId: StyleId,
  input: StyleInput,
): TemplateBuild => TEMPLATE_BUILDERS[templateId](wasm, styleId, input);
