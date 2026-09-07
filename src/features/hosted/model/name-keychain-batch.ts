import { strToU8, zipSync } from 'fflate';

import { fontDefinition } from '@/entities/keychain/fonts/catalog';
import { GeometryClient } from '@/infrastructure/geometry/geometry-client';

import type { SellerPreset } from '../api/hosted-api';

import { paramsForPresetOrder, type SellerPresetParams } from './seller-preset';

export const MAX_BATCH_ROWS = 25;

export type BatchOrder = {
  line: number;
  orderId: string;
  text: string;
  subtitle: string;
  quantity: number;
};

export type BatchRowError = {
  line: number;
  reason: string;
};

export type ParsedBatch = {
  orders: BatchOrder[];
  errors: BatchRowError[];
};

type BatchFile = {
  order: BatchOrder;
  data: Uint8Array;
  extension?: ExportBatchFormat;
};

export type ExportBatchFormat = 'stl' | '3mf';
export type BatchRunOptions = {
  format?: ExportBatchFormat;
  includeWarnings?: boolean;
  signal?: AbortSignal;
};

/** Rejected batches carry the row-level report without creating an empty archive. */
export class BatchGenerationError extends Error {
  constructor(
    message: string,
    readonly parsed: ParsedBatch,
  ) {
    super(message);
    this.name = 'BatchGenerationError';
  }
}

const readCsvRows = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(value.trim());
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows;
};

const fileNameForOrder = (orderId: string, format: ExportBatchFormat = 'stl'): string => {
  const safeId = orderId
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeId || 'order'}.${format}`;
};

const csvCell = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;

const manifestFor = (orders: BatchOrder[], errors: BatchRowError[], files: BatchFile[]): string => {
  const fileByOrder = new Map(
    files.map((file) => [file.order.orderId, fileNameForOrder(file.order.orderId, file.extension)]),
  );
  const errorByLine = new Map(errors.map((error) => [error.line, error.reason]));
  const orderLines = new Set(orders.map((order) => order.line));
  const rows = [
    'order_id,quantity,status,file,error',
    ...orders.map((order) =>
      [
        csvCell(order.orderId),
        csvCell(order.quantity),
        csvCell(fileByOrder.has(order.orderId) ? 'ready' : 'failed'),
        csvCell(fileByOrder.get(order.orderId) ?? ''),
        csvCell(errorByLine.get(order.line) ?? ''),
      ].join(','),
    ),
    ...errors
      .filter((error) => !orderLines.has(error.line))
      .map((error) =>
        [
          csvCell(`line-${error.line}`),
          csvCell(''),
          csvCell('invalid'),
          csvCell(''),
          csvCell(error.reason),
        ].join(','),
      ),
  ];

  return `${rows.join('\n')}\n`;
};

export const parseNameKeychainCsv = (input: string): ParsedBatch => {
  const rows = readCsvRows(input);
  const header = rows.shift()?.map((value) => value.toLocaleLowerCase());
  const orderIdIndex = header?.indexOf('order_id') ?? -1;
  const textIndex = header?.indexOf('text') ?? -1;
  const quantityIndex = header?.indexOf('quantity') ?? -1;
  if (orderIdIndex < 0 || textIndex < 0 || quantityIndex < 0)
    return {
      orders: [],
      errors: [{ line: 1, reason: 'Use order_id,text,quantity as the header.' }],
    };

  const orders: BatchOrder[] = [];
  const errors: BatchRowError[] = [];
  const orderIds = new Set<string>();
  const fileNames = new Set<string>();
  rows.forEach((row, index) => {
    const line = index + 2;
    if (!row.some(Boolean)) return;
    const orderId = row[orderIdIndex]?.trim() ?? '';
    const subtitleIndex = header?.indexOf('subtitle') ?? -1;
    const text = row[textIndex]?.trim() ?? '';
    const subtitle = subtitleIndex >= 0 ? (row[subtitleIndex]?.trim() ?? '') : '';
    const quantity = Number(row[quantityIndex]);
    if (!orderId || !text) {
      errors.push({ line, reason: 'order_id and text are required.' });
    } else if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      errors.push({ line, reason: 'quantity must be a whole number between 1 and 999.' });
    } else if (orderIds.has(orderId)) {
      errors.push({ line, reason: 'order_id must be unique in this batch.' });
    } else if (fileNames.has(fileNameForOrder(orderId))) {
      errors.push({ line, reason: 'order_id must create a unique printable filename.' });
    } else if (orders.length >= MAX_BATCH_ROWS) {
      errors.push({ line, reason: `A batch supports up to ${MAX_BATCH_ROWS} rows.` });
    } else {
      orderIds.add(orderId);
      fileNames.add(fileNameForOrder(orderId));
      orders.push({ line, orderId, text, subtitle, quantity });
    }
  });
  return { orders, errors };
};

export const createNameKeychainArchive = (
  orders: BatchOrder[],
  errors: BatchRowError[],
  files: BatchFile[],
  recipe: Record<string, unknown> = {},
): Uint8Array =>
  zipSync(
    {
      ...Object.fromEntries(
        files.map((file) => [fileNameForOrder(file.order.orderId, file.extension), file.data]),
      ),
      'manifest.csv': strToU8(manifestFor(orders, errors, files)),
      'recipe.json': strToU8(`${JSON.stringify(recipe, null, 2)}\n`),
    },
    { level: 0 },
  );

export const runNameKeychainBatch = async (
  preset: SellerPreset,
  csv: string,
  onProgress?: (completed: number, total: number) => void,
  options: BatchRunOptions = {},
): Promise<{
  archive: Uint8Array;
  parsed: ParsedBatch;
  completed: number;
}> => {
  const parsed = parseNameKeychainCsv(csv);
  if (!parsed.orders.length)
    throw new BatchGenerationError(
      parsed.errors[0]?.reason ?? 'Add at least one valid order.',
      parsed,
    );
  const client = new GeometryClient();
  const files: BatchFile[] = [];
  const errors = [...parsed.errors];
  const format = options.format ?? 'stl';
  const signal = options.signal;
  const throwIfAborted = (): void => {
    if (signal?.aborted) throw new DOMException('Batch generation aborted.', 'AbortError');
  };
  const artifactByParams = new Map<string, Uint8Array>();
  const abortClient = (): void => client.dispose();
  signal?.addEventListener('abort', abortClient, { once: true });
  try {
    for (const [index, order] of parsed.orders.entries()) {
      throwIfAborted();
      try {
        const params = paramsForPresetOrder(
          preset.params as SellerPresetParams,
          order.text,
          order.subtitle,
        );
        const normalizedKey = JSON.stringify(params);
        const validation = await client.validate(
          params,
          fontDefinition(params.fontId),
          fontDefinition(params.subtitleFontId),
        );
        const hasError = validation.issues.some((issue) => issue.severity === 'error');
        const hasWarning = validation.issues.some((issue) => issue.severity === 'warning');
        if (hasError || (hasWarning && !options.includeWarnings)) {
          throw new Error(
            validation.issues
              .filter((issue) => issue.severity === 'error' || !options.includeWarnings)
              .map((issue) => issue.message)
              .join('; ') || 'The model is not ready to download.',
          );
        }
        let data = artifactByParams.get(normalizedKey);
        if (!data) {
          const file = await client.export(
            params,
            format,
            'separate-colors',
            fontDefinition(params.fontId),
            undefined,
            fontDefinition(params.subtitleFontId),
          );
          data = new Uint8Array(file.data);
          artifactByParams.set(normalizedKey, data);
        }
        files.push({ order, data, extension: format });
      } catch (cause) {
        if (signal?.aborted) throwIfAborted();
        errors.push({
          line: order.line,
          reason: cause instanceof Error ? cause.message : 'The model could not be generated.',
        });
      }
      onProgress?.(index + 1, parsed.orders.length);
    }
  } finally {
    signal?.removeEventListener('abort', abortClient);
    client.dispose();
  }
  throwIfAborted();
  if (!files.length)
    throw new BatchGenerationError(
      errors[0]?.reason ?? 'No valid printable orders were generated.',
      { orders: parsed.orders, errors },
    );
  const recipe = {
    presetId: preset.id,
    presetName: preset.name,
    format,
    printProfileId: preset.print_profile_id,
    params: Object.fromEntries(
      Object.entries(preset.params).filter(
        ([key]) => key !== 'text' && key !== 'subtitle' && key !== 'modelFeatures',
      ),
    ),
  };
  return {
    archive: createNameKeychainArchive(parsed.orders, errors, files, recipe),
    parsed: { orders: parsed.orders, errors },
    completed: files.length,
  };
};
