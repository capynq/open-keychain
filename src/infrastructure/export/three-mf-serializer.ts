import { zipSync, strToU8 } from 'fflate';

import {
  DEFAULT_PRINT_APPEARANCE,
  type MeshBuffer,
  type PrintAppearance,
  type ThreeMfMode,
} from '../../domain/keychain/model/types';
type ThreeMfPart = {
  name: string;
  mesh: MeshBuffer;
  color: string;
};
const normalizeColor = (color: string): string => {
  const normalized = color.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}(?:[0-9A-F]{2})?$/.test(normalized)) {
    throw new Error(`Invalid 3MF color: ${color}`);
  }
  return normalized;
};
const escapeXml = (value: string): string => {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? character,
  );
};
const meshXml = (parts: ThreeMfPart[]): string => {
  let vertices = '';
  for (const part of parts) {
    for (let index = 0; index < part.mesh.positions.length; index += 3) {
      vertices += `<vertex x="${part.mesh.positions[index].toFixed(6)}" y="${part.mesh.positions[index + 1].toFixed(6)}" z="${part.mesh.positions[index + 2].toFixed(6)}"/>`;
    }
  }
  let triangles = '';
  let triangleVertexOffset = 0;
  for (const [partIndex, part] of parts.entries()) {
    for (let index = 0; index < part.mesh.indices.length; index += 3) {
      const properties =
        partIndex === 0 ? '' : ` pid="10" p1="${partIndex}" p2="${partIndex}" p3="${partIndex}"`;
      triangles += `<triangle v1="${part.mesh.indices[index] + triangleVertexOffset}" v2="${part.mesh.indices[index + 1] + triangleVertexOffset}" v3="${part.mesh.indices[index + 2] + triangleVertexOffset}"${properties}/>`;
    }
    triangleVertexOffset += part.mesh.positions.length / 3;
  }
  return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`;
};
const modelXml = (parts: ThreeMfPart[]): string => {
  const object = `<object id="1" type="model" name="Keychain" pid="10" pindex="0">${meshXml(parts)}</object>`;
  const materials = parts
    .map(
      (part) =>
        `<base name="${escapeXml(part.name)}" displaycolor="${normalizeColor(part.color)}"/>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Open Keychain</metadata>
  <metadata name="Description">Printable keychain generated locally in the browser.</metadata>
  <resources><basematerials id="10">${materials}</basematerials>${object}</resources>
  <build><item objectid="1"/></build>
</model>`;
};

/** Prusa ignores Core display colors; named volumes preserve alignment and color references. */
const prusaModelConfig = (parts: ThreeMfPart[]): string => {
  let firstTriangle = 0;
  const volumes = parts
    .map((part) => {
      const triangleCount = part.mesh.indices.length / 3;
      if (triangleCount === 0) return '';
      const first = firstTriangle;
      firstTriangle += triangleCount;
      return `<volume firstid="${first}" lastid="${firstTriangle - 1}"><metadata type="volume" key="name" value="${escapeXml(`${part.name} (${normalizeColor(part.color)})`)}"/><metadata type="volume" key="volume_type" value="ModelPart"/></volume>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><config><object id="1" instances_count="1"><metadata type="object" key="name" value="Keychain"/>${volumes}</object></config>`;
};
/** Serialize printable meshes only. Viewer surfaces and lighting never enter this archive. */
export const serializeThreeMf = (
  baseMesh: MeshBuffer,
  reliefMesh: MeshBuffer,
  mergedMesh: MeshBuffer | undefined,
  mode: ThreeMfMode = 'separate-colors',
  appearance: PrintAppearance = DEFAULT_PRINT_APPEARANCE,
): ArrayBuffer => {
  const parts: ThreeMfPart[] =
    mode === 'merged'
      ? [{ name: 'Keychain', mesh: mergedMesh ?? baseMesh, color: appearance.base.color }]
      : [
          { name: appearance.base.name, mesh: baseMesh, color: appearance.base.color },
          { name: appearance.relief.name, mesh: reliefMesh, color: appearance.relief.color },
        ];
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="config" ContentType="application/octet-stream"/>
  <Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`),
    '3D/3dmodel.model': strToU8(modelXml(parts)),
  };
  if (mode === 'separate-colors')
    files['Metadata/Slic3r_PE_model.config'] = strToU8(prusaModelConfig(parts));
  const zipped = zipSync(files);
  return zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
};
