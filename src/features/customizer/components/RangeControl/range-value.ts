export const decimalsFor = (step: number): number => {
  const text = String(step);
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
};

/** Clamp a typed value to the slider range and snap it to the slider step. */
export const commitRangeValue = (raw: string, min: number, max: number, step: number) => {
  const parsed = Number(raw.replace(',', '.'));
  if (!Number.isFinite(parsed)) return undefined;
  const snapped = Math.round((Math.min(max, Math.max(min, parsed)) - min) / step) * step + min;
  return Number(snapped.toFixed(decimalsFor(step)));
};
