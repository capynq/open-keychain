import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PARAMS } from '@/entities/keychain/model/types';
import { GeometryClient } from '@/infrastructure/geometry/geometry-client';

import {
  createNameKeychainArchive,
  parseNameKeychainCsv,
  runNameKeychainBatch,
} from './name-keychain-batch';

vi.mock('@/infrastructure/geometry/geometry-client', () => ({ GeometryClient: vi.fn() }));

const mockedClient = vi.mocked(GeometryClient);
const makePreset = () => ({
  id: 'preset-1',
  name: 'Names',
  params: {
    ...DEFAULT_PARAMS,
    text: undefined,
    subtitle: undefined,
    modelFeatures: { artwork: 'private-customer-data' },
  },
  print_profile_id: 'fdm-standard-0.4',
  created_at: '',
  updated_at: '',
});
type TestIssue = { severity: 'warning' | 'error'; message: string };

const makeResult = (issues: TestIssue[]) => ({
  issues: issues.map((issue) => ({ ...issue, code: issue.severity })),
});
const configureClient = (issues: TestIssue[] = []) => {
  const validate = vi.fn().mockResolvedValue(makeResult(issues));
  const exportMethod = vi.fn().mockResolvedValue({ data: new ArrayBuffer(3) });
  const dispose = vi.fn();
  // eslint-disable-next-line prefer-arrow-callback
  mockedClient.mockImplementation(function MockGeometryClient() {
    return { validate, export: exportMethod, dispose } as unknown as GeometryClient;
  });
  return { validate, exportMethod, dispose };
};

beforeEach(() => mockedClient.mockReset());

describe('name keychain batch CSV', () => {
  it('keeps names out of the manifest while preserving a printable order file', () => {
    const parsed = parseNameKeychainCsv('order_id,text,quantity\netsy-42,ALEX,2\n');
    const archive = createNameKeychainArchive(parsed.orders, parsed.errors, [
      { order: parsed.orders[0], data: new Uint8Array([1, 2, 3]) },
    ]);
    const files = unzipSync(archive);

    expect(Object.keys(files).sort()).toEqual(['etsy-42.stl', 'manifest.csv', 'recipe.json']);
    expect(strFromU8(files['manifest.csv'])).not.toContain('ALEX');
    expect(strFromU8(files['manifest.csv'])).toContain('etsy-42');
  });

  it('reports malformed, duplicate, and over-limit rows without accepting them', () => {
    const header = 'order_id,text,quantity';
    const rows = Array.from({ length: 26 }, (_, index) => `order-${index},ALEX,1`);
    const parsed = parseNameKeychainCsv([header, ...rows, 'order-0,MIRA,1', 'bad,,0'].join('\n'));

    expect(parsed.orders).toHaveLength(25);
    expect(parsed.errors.map((error) => error.reason)).toEqual(
      expect.arrayContaining([
        'A batch supports up to 25 rows.',
        'order_id must be unique in this batch.',
        'order_id and text are required.',
      ]),
    );
  });

  it('rejects order ids that would overwrite the same printable filename', () => {
    const parsed = parseNameKeychainCsv('order_id,text,quantity\norder/a,ALEX,1\norder?a,MIRA,1\n');

    expect(parsed.orders).toHaveLength(1);
    expect(parsed.errors).toContainEqual({
      line: 3,
      reason: 'order_id must create a unique printable filename.',
    });
  });

  it('parses an optional subtitle for the Heart right word handoff', () => {
    const parsed = parseNameKeychainCsv('order_id,text,subtitle,quantity\nheart-1,LOVE,HOPE,1\n');
    expect(parsed.orders[0]).toMatchObject({ text: 'LOVE', subtitle: 'HOPE' });
  });

  it('blocks warnings by default and allows them explicitly', async () => {
    const client = configureClient([{ severity: 'warning', message: 'Thin wall.' }]);
    const csv = 'order_id,text,quantity\nwarning-1,ALEX,1\n';
    await expect(runNameKeychainBatch(makePreset(), csv)).rejects.toThrow('Thin wall.');
    expect(client.exportMethod).not.toHaveBeenCalled();
    await expect(
      runNameKeychainBatch(makePreset(), csv, undefined, { includeWarnings: true }),
    ).resolves.toMatchObject({ completed: 1 });
    expect(client.exportMethod).toHaveBeenCalledTimes(1);
  });

  it('never exports a validation error', async () => {
    const client = configureClient([{ severity: 'error', message: 'Invalid mesh.' }]);
    await expect(
      runNameKeychainBatch(makePreset(), 'order_id,text,quantity\nerror-1,ALEX,1\n'),
    ).rejects.toThrow('Invalid mesh.');
    expect(client.exportMethod).not.toHaveBeenCalled();
  });

  it('aborts before creating an archive and disposes the client', async () => {
    const client = configureClient();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runNameKeychainBatch(makePreset(), 'order_id,text,quantity\nabort-1,ALEX,1\n', undefined, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(client.dispose).toHaveBeenCalledTimes(1);
    expect(client.exportMethod).not.toHaveBeenCalled();
  });

  it('deduplicates identical artifacts while preserving manifest orders and quantities', async () => {
    const client = configureClient();
    const result = await runNameKeychainBatch(
      makePreset(),
      'order_id,text,quantity\none,ALEX,2\ntwo,ALEX,5\n',
    );
    const manifest = strFromU8(unzipSync(result.archive)['manifest.csv']);
    expect(client.exportMethod).toHaveBeenCalledTimes(1);
    expect(manifest).toContain('"one","2","ready"');
    expect(manifest).toContain('"two","5","ready"');
  });

  it('passes 3mf through to export and keeps customer text out of recipe.json', async () => {
    const client = configureClient();
    const result = await runNameKeychainBatch(
      makePreset(),
      'order_id,text,subtitle,quantity\nthree,MIRA,SECRET,1\n',
      undefined,
      { format: '3mf' },
    );
    const files = unzipSync(result.archive);
    const recipe = strFromU8(files['recipe.json']);
    expect(client.exportMethod).toHaveBeenCalledWith(
      expect.anything(),
      '3mf',
      expect.anything(),
      expect.anything(),
      undefined,
      expect.anything(),
    );
    expect(Object.keys(files)).toContain('three.3mf');
    expect(recipe).not.toContain('MIRA');
    expect(recipe).not.toContain('SECRET');
    expect(recipe).not.toContain('private-customer-data');
  });

  it('records an export failure once on the actual order row', async () => {
    const client = configureClient();
    client.exportMethod.mockImplementationOnce(async () => {
      throw new Error('Export failed.');
    });
    const result = await runNameKeychainBatch(
      makePreset(),
      'order_id,text,quantity\nfailing,ALEX,1\nready,MIRA,1\n',
    );
    const manifest = strFromU8(unzipSync(result.archive)['manifest.csv']);
    expect(manifest.match(/failing/g)).toHaveLength(1);
    expect(manifest).toContain('Export failed.');
  });
});
