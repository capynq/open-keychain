import { describe, expect, it } from 'vitest';

import { findStructuralProblems, readTags } from './three-mf-structure';

const separateModel = ({
  groupId = '7',
  objectPid = '7',
  trianglePid = '7',
  secondRegion = '1',
  colorCount = 2,
  omitColorGroup = false,
  reorder = false,
}: {
  groupId?: string;
  objectPid?: string;
  trianglePid?: string;
  secondRegion?: string;
  colorCount?: number;
  omitColorGroup?: boolean;
  reorder?: boolean;
} = {}): string => {
  const colors = Array.from({ length: colorCount }, () => '<m:color color="#AABBCCFF"/>').join('');
  const group = omitColorGroup ? '' : `<m:colorgroup id="${groupId}">${colors}</m:colorgroup>`;
  const model = reorder
    ? '<model xmlns:m="x" unit="millimeter" xml:lang="en-US">'
    : '<model unit="millimeter" xml:lang="en-US" xmlns:m="x">';
  const object = reorder
    ? `<object name="Keychain" pindex="0" pid="${objectPid}" id="1" type="model">`
    : `<object id="1" type="model" name="Keychain" pid="${objectPid}" pindex="0">`;
  const triangleA = reorder
    ? `<triangle p1="0" pid="${trianglePid}" v3="2" v2="1" v1="0"/>`
    : `<triangle v1="0" v2="1" v3="2" pid="${trianglePid}" p1="0"/>`;
  const triangleB = reorder
    ? `<triangle pid="${trianglePid}" p1="${secondRegion}" v3="5" v2="4" v1="3"/>`
    : `<triangle v1="3" v2="4" v3="5" pid="${trianglePid}" p1="${secondRegion}"/>`;
  return `<?xml version="1.0"?>${model}<resources>${group}${object}<mesh><triangles>${triangleA}${triangleB}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
};

const mergedModel = (): string =>
  '<model unit="millimeter" xmlns="x"><resources><object id="1" type="model"><mesh><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources><build><item objectid="1"/></build></model>';

describe('readTags', () => {
  it('parses attributes regardless of their order and quoting', () => {
    const tags = readTags(`<triangle pid="3" v1="0"/><triangle v1='1' pid='4'/>`, 'triangle');
    expect(tags).toEqual([
      { pid: '3', v1: '0' },
      { v1: '1', pid: '4' },
    ]);
  });

  it('does not match a tag whose name only shares a prefix', () => {
    const xml = '<m:colorgroup id="1"><m:color color="#000000FF"/></m:colorgroup>';
    expect(readTags(xml, 'm:color')).toHaveLength(1);
    expect(readTags(xml, 'm:colorgroup')).toEqual([{ id: '1' }]);
  });
});

describe('findStructuralProblems (separate-colors)', () => {
  it('accepts a valid model', () => {
    expect(findStructuralProblems(separateModel(), 'separate-colors')).toEqual([]);
  });

  it('accepts attributes in a different order', () => {
    expect(findStructuralProblems(separateModel({ reorder: true }), 'separate-colors')).toEqual([]);
  });

  it('reports a missing color group', () => {
    const problems = findStructuralProblems(
      separateModel({ omitColorGroup: true }),
      'separate-colors',
    );
    expect(problems).toContain('missing color group');
  });

  it('reports wrong triangle pids', () => {
    const problems = findStructuralProblems(separateModel({ trianglePid: '9' }), 'separate-colors');
    expect(problems).toContain('no triangle references the color group');
  });

  it('reports an object pid that does not match the color group', () => {
    const problems = findStructuralProblems(separateModel({ objectPid: '9' }), 'separate-colors');
    expect(problems.some((problem) => problem.startsWith('build object pid 9'))).toBe(true);
  });

  it('reports when no triangle uses the second color region', () => {
    const problems = findStructuralProblems(
      separateModel({ secondRegion: '0' }),
      'separate-colors',
    );
    expect(problems).toEqual(['no triangle is assigned to the second color region']);
  });

  it('requires exactly two colors', () => {
    const problems = findStructuralProblems(separateModel({ colorCount: 3 }), 'separate-colors');
    expect(problems).toEqual(['expected exactly 2 colors, found 3']);
  });

  it('rejects a non-millimeter unit', () => {
    const problems = findStructuralProblems(
      separateModel().replace('unit="millimeter"', 'unit="inch"'),
      'separate-colors',
    );
    expect(problems).toContain('model unit is not millimeter');
  });
});

describe('findStructuralProblems (merged)', () => {
  it('accepts a single item without a color group', () => {
    expect(findStructuralProblems(mergedModel(), 'merged')).toEqual([]);
  });

  it('rejects a merged model that declares a color group', () => {
    expect(findStructuralProblems(separateModel(), 'merged')).toEqual([
      'merged model must not declare a color group',
    ]);
  });

  it('rejects more than one build item', () => {
    const xml = mergedModel().replace('</build>', '<item objectid="1"/></build>');
    expect(findStructuralProblems(xml, 'merged')).toEqual([
      'expected exactly one build item, found 2',
    ]);
  });
});
