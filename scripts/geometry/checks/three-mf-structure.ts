export type XmlAttributes = Record<string, string>;

const ATTRIBUTE_PATTERN = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseAttributes = (body: string): XmlAttributes => {
  const attributes: XmlAttributes = {};
  for (const [, name, doubleQuoted, singleQuoted] of body.matchAll(ATTRIBUTE_PATTERN)) {
    if (name) attributes[name] = doubleQuoted ?? singleQuoted ?? '';
  }
  return attributes;
};

/**
 * Returns the attribute map of every start or self-closing tag named `tagName`.
 * Attribute order is irrelevant; the tag name must be followed by whitespace, `/` or `>`,
 * so `m:color` does not match `m:colorgroup`.
 */
export const readTags = (xml: string, tagName: string): XmlAttributes[] => {
  const pattern = new RegExp(`<${escapeRegExp(tagName)}(?=[\\s/>])([^>]*)>`, 'g');
  return [...xml.matchAll(pattern)].map(([, body]) => parseAttributes(body ?? ''));
};

export type ThreeMfStructureMode = 'separate-colors' | 'merged';

/**
 * Structural invariants of a generated 3MF model part. Returns human-readable problems;
 * an empty array means the model satisfies the contract for the given mode.
 */
export const findStructuralProblems = (xml: string, mode: ThreeMfStructureMode): string[] => {
  const problems: string[] = [];
  const [model] = readTags(xml, 'model');
  if (model?.unit !== 'millimeter') problems.push('model unit is not millimeter');

  const items = readTags(xml, 'item');
  if (items.length !== 1) problems.push(`expected exactly one build item, found ${items.length}`);

  const colorGroups = readTags(xml, 'm:colorgroup');
  if (mode === 'merged') {
    if (colorGroups.length > 0) problems.push('merged model must not declare a color group');
    return problems;
  }

  const colors = readTags(xml, 'm:color');
  if (colors.length !== 2) problems.push(`expected exactly 2 colors, found ${colors.length}`);

  const groupId = colorGroups[0]?.id;
  if (!groupId) {
    problems.push('missing color group');
    return problems;
  }

  const buildObjectId = items[0]?.objectid;
  const object = readTags(xml, 'object').find((attributes) => attributes.id === buildObjectId);
  if (object?.pid !== groupId)
    problems.push(
      `build object pid ${object?.pid ?? '(missing)'} does not match color group ${groupId}`,
    );

  const triangles = readTags(xml, 'triangle');
  if (!triangles.some((triangle) => triangle.pid === groupId))
    problems.push('no triangle references the color group');
  else if (!triangles.some((triangle) => triangle.pid === groupId && triangle.p1 === '1'))
    problems.push('no triangle is assigned to the second color region');

  return problems;
};
