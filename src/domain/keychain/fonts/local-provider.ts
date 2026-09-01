import * as opentype from 'opentype.js';

import type { FontDefinition, FontScript } from './catalog';

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<FileSystemFileHandle[]>;
  }
  interface FileSystemFileHandle {
    queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  }
}

export type LocalFontRecord = {
  id: string;
  name: string;
  fileName: string;
  handle?: FileSystemFileHandle;
  font?: FontDefinition;
  status: 'available' | 'unavailable';
};

type StoredLocalFontRecord = Omit<LocalFontRecord, 'font'> & {
  font?: Omit<FontDefinition, 'data'>;
};

const DB_NAME = 'open-keychain-fonts';
const STORE_NAME = 'files';
const supportsFilePicker = (): boolean =>
  typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
export const isLocalFontId = (id: string): boolean => id.startsWith('local-');

const mergeRecords = (
  current: LocalFontRecord[],
  additions: LocalFontRecord[],
): LocalFontRecord[] => [
  ...current,
  ...additions.filter((record) => !current.some((existing) => existing.id === record.id)),
];

const parse = (data: ArrayBuffer): opentype.Font => {
  const module = opentype as unknown as {
    parse?: (value: ArrayBuffer) => opentype.Font;
    default?: { parse?: (value: ArrayBuffer) => opentype.Font };
  };
  const parser = module.parse ?? module.default?.parse;
  if (!parser) throw new Error('OpenType parser is unavailable.');
  return parser(data);
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable.'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open font storage.'));
  });

const readRecords = async (): Promise<LocalFontRecord[]> => {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result as LocalFontRecord[]) ?? []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
};

const writeRecord = async (record: LocalFontRecord): Promise<void> => {
  if (!record.handle) return;
  try {
    const font = Object.fromEntries(
      Object.entries(record.font ?? {}).filter(([key]) => key !== 'data'),
    ) as Omit<FontDefinition, 'data'>;
    const stored: StoredLocalFontRecord = {
      ...record,
      font: record.font ? font : undefined,
    };
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(stored);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    return;
  }
};

const deleteRecord = async (id: string): Promise<void> => {
  try {
    const db = await openDatabase();
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
  } catch {
    return;
  }
};

const fontDataRevision = (data: ArrayBuffer): string => {
  let hash = 2166136261;
  for (const byte of new Uint8Array(data)) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const fontDefinitionFromBytes = (
  id: string,
  fileName: string,
  data: ArrayBuffer,
  dataRevision = fontDataRevision(data),
): FontDefinition => {
  const parsed = parse(data) as unknown as {
    names?: {
      windows?: Record<string, { en?: string }>;
      fontFamily?: { en?: string };
      fullName?: { en?: string };
      fontSubfamily?: { en?: string };
    };
    glyphs?: { glyphs: Record<string, { unicode?: number }> };
    tables?: { os2?: { usWeightClass?: number } };
  };
  const names = parsed.names?.windows ?? parsed.names;
  const family = names?.fontFamily?.en ?? names?.fullName?.en ?? fileName;
  const style = names?.fontSubfamily?.en ?? '';
  const name = style && style.toLowerCase() !== 'regular' ? `${family} ${style}` : family;
  const glyphs = Object.values(parsed.glyphs?.glyphs ?? {});
  const scripts: readonly FontScript[] = glyphs.some(
    (glyph) => glyph.unicode !== undefined && glyph.unicode >= 0x0400 && glyph.unicode <= 0x04ff,
  )
    ? ['latin', 'cyrillic']
    : ['latin'];
  return {
    id,
    name,
    file: '',
    data,
    dataRevision,
    previewFamily: `OpenLocalFont-${id}`,
    weight: Number(parsed.tables?.os2?.usWeightClass ?? 400),
    category: 'Decorative',
    scripts,
    supportsArticulated: false,
    sampleLatin: 'ALEX',
    sampleCyrillic: 'АБВГ',
    source: 'local',
    provider: 'local-file',
  };
};

const localFontId = (file: File, data: ArrayBuffer): string => {
  const name = file.name
    .normalize('NFC')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `local-${name}-${fontDataRevision(data)}`;
};

const makeRecord = async (file: File, handle?: FileSystemFileHandle): Promise<LocalFontRecord> => {
  const data = await file.arrayBuffer();
  const dataRevision = fontDataRevision(data);
  const id = localFontId(file, data);
  return {
    id,
    name: file.name,
    fileName: file.name,
    handle,
    font: fontDefinitionFromBytes(id, file.name, data, dataRevision),
    status: 'available',
  };
};

export const createLocalFontStore = () => {
  let records: LocalFontRecord[] = [];
  let restored = false;
  let restoring: Promise<LocalFontRecord[]> | undefined;
  return {
    supportsFilePicker,
    async restore(): Promise<LocalFontRecord[]> {
      if (restored) return records;
      restoring ??= (async () => {
        const stored = await readRecords();
        for (const record of stored) {
          if (!record.handle) {
            record.status = 'unavailable';
            continue;
          }
          try {
            const permission = record.handle.queryPermission
              ? await record.handle.queryPermission({ mode: 'read' })
              : 'granted';
            if (permission !== 'granted') {
              record.status = 'unavailable';
              continue;
            }
            const file = await record.handle.getFile();
            record.font = fontDefinitionFromBytes(
              record.id,
              record.fileName,
              await file.arrayBuffer(),
            );
            record.status = 'available';
          } catch {
            record.status = 'unavailable';
          }
        }
        records = mergeRecords(records, stored);
        restored = true;
        return records;
      })();
      return restoring;
    },
    async importFiles(files: FileList | File[]): Promise<LocalFontRecord[]> {
      const imported: LocalFontRecord[] = [];
      for (const file of Array.from(files)) {
        if (!/\.(ttf|otf)$/i.test(file.name)) continue;
        try {
          const record = await makeRecord(file);
          if (records.some((existing) => existing.id === record.id)) continue;
          records.push(record);
          imported.push(record);
        } catch {
          continue;
        }
      }
      return imported;
    },
    async pick(): Promise<LocalFontRecord[]> {
      if (!supportsFilePicker()) return [];
      const picker = window.showOpenFilePicker;
      if (!picker) return [];
      let handles: FileSystemFileHandle[];
      try {
        handles = await picker({
          multiple: true,
          types: [{ description: 'Fonts', accept: { 'font/ttf': ['.ttf'], 'font/otf': ['.otf'] } }],
        });
      } catch {
        return [];
      }
      const imported: LocalFontRecord[] = [];
      for (const handle of handles) {
        try {
          const record = await makeRecord(await handle.getFile(), handle);
          if (records.some((existing) => existing.id === record.id)) continue;
          records.push(record);
          imported.push(record);
          await writeRecord(record);
        } catch {
          continue;
        }
      }
      return imported;
    },
    async reconnect(id: string): Promise<LocalFontRecord | undefined> {
      const record = records.find((item) => item.id === id);
      if (!record) return undefined;
      try {
        if (supportsFilePicker()) {
          const picker = window.showOpenFilePicker;
          if (!picker) return undefined;
          const [handle] = await picker({
            multiple: false,
            types: [
              {
                description: 'Fonts',
                accept: { 'font/ttf': ['.ttf'], 'font/otf': ['.otf'] },
              },
            ],
          });
          const file = await handle.getFile();
          if (!/\.(ttf|otf)$/i.test(file.name)) return undefined;
          record.handle = handle;
          record.name = file.name;
          record.fileName = file.name;
          const data = await file.arrayBuffer();
          record.font = fontDefinitionFromBytes(id, file.name, data);
        } else if (record.handle) {
          const permission = record.handle.requestPermission
            ? await record.handle.requestPermission({ mode: 'read' })
            : 'granted';
          if (permission !== 'granted') return undefined;
          const file = await record.handle.getFile();
          const data = await file.arrayBuffer();
          record.font = fontDefinitionFromBytes(id, record.fileName, data);
        } else {
          return undefined;
        }
        record.status = 'available';
        await writeRecord(record);
        return record;
      } catch {
        return undefined;
      }
    },
    async remove(id: string): Promise<void> {
      records = records.filter((record) => record.id !== id);
      await deleteRecord(id);
    },
  };
};
