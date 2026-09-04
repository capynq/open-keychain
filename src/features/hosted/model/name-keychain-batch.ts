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
};

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

const fileNameForOrder = (orderId: string): string => {
  const safeId = orderId
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeId || 'order'}.stl`;
};

const csvCell = (value: string | number): string => `"${String(value).replaceAll('"', '""')}"`;

const manifestFor = (orders: BatchOrder[], errors: BatchRowError[], files: BatchFile[]): string => {
  const fileByOrder = new Map(
    files.map((file) => [file.order.orderId, fileNameForOrder(file.order.orderId)]),
  );
  const rows = [
    'order_id,quantity,status,file,error',
    ...orders.map((order) =>
      [
        csvCell(order.orderId),
        csvCell(order.quantity),
        csvCell(fileByOrder.has(order.orderId) ? 'ready' : 'failed'),
        csvCell(fileByOrder.get(order.orderId) ?? ''),
        csvCell(''),
      ].join(','),
    ),
    ...errors.map((error) =>
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
    const text = row[textIndex]?.trim() ?? '';
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
      orders.push({ line, orderId, text, quantity });
    }
  });
  return { orders, errors };
};

export const createNameKeychainArchive = (
  orders: BatchOrder[],
  errors: BatchRowError[],
  files: BatchFile[],
): Uint8Array =>
  zipSync(
    {
      ...Object.fromEntries(files.map((file) => [fileNameForOrder(file.order.orderId), file.data])),
      'manifest.csv': strToU8(manifestFor(orders, errors, files)),
    },
    { level: 0 },
  );

export const runNameKeychainBatch = async (
  preset: SellerPreset,
  csv: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{
  archive: Uint8Array;
  parsed: ParsedBatch;
  completed: number;
}> => {
  const parsed = parseNameKeychainCsv(csv);
  if (!parsed.orders.length)
    throw new Error(parsed.errors[0]?.reason ?? 'Add at least one valid order.');
  const client = new GeometryClient();
  const files: BatchFile[] = [];
  const errors = [...parsed.errors];
  try {
    for (const [index, order] of parsed.orders.entries()) {
      try {
        const params = paramsForPresetOrder(preset.params as SellerPresetParams, order.text);
        const file = await client.export(
          params,
          'stl',
          'separate-colors',
          fontDefinition(params.fontId),
        );

        files.push({ order, data: new Uint8Array(file.data) });
      } catch (cause) {
        errors.push({
          line: order.line,
          reason: cause instanceof Error ? cause.message : 'The model could not be generated.',
        });
      }
      onProgress?.(index + 1, parsed.orders.length);
    }
  } finally {
    client.dispose();
  }
  return {
    archive: createNameKeychainArchive(parsed.orders, errors, files),
    parsed: { orders: parsed.orders, errors },
    completed: files.length,
  };
};
