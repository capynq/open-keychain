import { zipSync, strToU8 } from 'fflate';
import { DEFAULT_PRINT_APPEARANCE, type MeshBuffer, type PrintAppearance, type ThreeMfMode } from './types';

type ThreeMfPart = {
  name: string;
  mesh: MeshBuffer;
  color: string;
};

function escapeXml(value: string): string {
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
}

function meshXml(mesh: MeshBuffer): string {
  let vertices = '';
  for (let index = 0; index < mesh.positions.length; index += 3) {
    vertices += `<vertex x="${mesh.positions[index].toFixed(6)}" y="${mesh.positions[index + 1].toFixed(6)}" z="${mesh.positions[index + 2].toFixed(6)}"/>`;
  }
  let triangles = '';
  for (let index = 0; index < mesh.indices.length; index += 3) {
    triangles += `<triangle v1="${mesh.indices[index]}" v2="${mesh.indices[index + 1]}" v3="${mesh.indices[index + 2]}"/>`;
  }
  return `<mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh>`;
}

function modelXml(parts: ThreeMfPart[]): string {
  const resources = parts
    .map((part, index) => {
      const id = index + 1;
      return `<object id="${id}" type="model" pid="10" pindex="${index}"><name>${escapeXml(part.name)}</name>${meshXml(part.mesh)}</object>`;
    })
    .join('');
  const materials = parts.map((part) => `<base name="${escapeXml(part.name)}" displaycolor="${part.color}"/>`).join('');
  const build = parts.map((_, index) => `<item objectid="${index + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Open Keychain</metadata>
  <metadata name="Description">Printable keychain generated locally in the browser.</metadata>
  <resources><basematerials id="10">${materials}</basematerials>${resources}</resources>
  <build>${build}</build>
</model>`;
}

/** Serialize printable meshes only. Viewer surfaces and lighting never enter this archive. */
export function serializeThreeMf(
  baseMesh: MeshBuffer,
  reliefMesh: MeshBuffer,
  mergedMesh: MeshBuffer | undefined,
  mode: ThreeMfMode = 'separate-colors',
  appearance: PrintAppearance = DEFAULT_PRINT_APPEARANCE,
): ArrayBuffer {
  const parts: ThreeMfPart[] =
    mode === 'merged'
      ? [{ name: 'Keychain', mesh: mergedMesh ?? baseMesh, color: appearance.base.color }]
      : [
          { name: appearance.base.name, mesh: baseMesh, color: appearance.base.color },
          { name: appearance.relief.name, mesh: reliefMesh, color: appearance.relief.color },
        ];
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`),
    '3D/3dmodel.model': strToU8(modelXml(parts)),
  };
  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}
