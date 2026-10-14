import type { ScoreInput } from './types';

const numberFormatter = new Intl.NumberFormat('en-US');

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function weightedAverage(values: ScoreInput[]) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

export function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}
