import { EDGE_FINISH_GRID_MM } from '@/domain/keychain/model/edge-finish';

export type FinishStrength = { id: 'light' | 'medium' | 'strong'; amountMm: number };

/** Choose distinct, verified amounts. Never invent a second strength below the print grid. */
export const finishStrengths = (maximumMm: number): FinishStrength[] => {
  if (!Number.isFinite(maximumMm)) return [];
  const steps = Math.floor((Math.min(0.8, Math.max(0, maximumMm)) + 1e-8) / EDGE_FINISH_GRID_MM);
  if (steps < 1) return [];
  const positions = [...new Set([1, Math.ceil(steps / 2), steps])];
  return positions.map((position, index) => ({
    id: index === 0 ? 'light' : index === positions.length - 1 ? 'strong' : 'medium',
    amountMm: Math.round(position * EDGE_FINISH_GRID_MM * 10) / 10,
  }));
};
