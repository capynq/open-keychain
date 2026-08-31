import {
  buildStyle,
  type StyleBuild,
  type StyleInput,
} from '../../../domain/keychain/styles/style-builder';
import type { StyleId } from '../../../domain/keychain/model/types';
import type { GeometryWasm } from '../../../infrastructure/geometry/manifold-types';

export type StyleBuilder = (wasm: GeometryWasm, input: StyleInput) => StyleBuild;

export const STYLE_BUILDERS: Readonly<Record<StyleId, StyleBuilder>> = {
  plain: (wasm, input) => buildStyle(wasm, 'plain', input),
  contour: (wasm, input) => buildStyle(wasm, 'contour', input),
  capsule: (wasm, input) => buildStyle(wasm, 'capsule', input),
  'soft-tag': (wasm, input) => buildStyle(wasm, 'soft-tag', input),
  bubble: (wasm, input) => buildStyle(wasm, 'bubble', input),
  arch: (wasm, input) => buildStyle(wasm, 'arch', input),
  ribbon: (wasm, input) => buildStyle(wasm, 'ribbon', input),
};

export const buildRegisteredStyle = (
  wasm: GeometryWasm,
  styleId: StyleId,
  input: StyleInput,
): StyleBuild => STYLE_BUILDERS[styleId](wasm, input);
