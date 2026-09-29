import { formatNumber } from './currency.js';

// fraction 0.75 -> "75%"; 1.17618 -> "117,62%"
export function formatPercent(fraction, maxFraction = 2) {
  if (typeof fraction !== 'number' || !Number.isFinite(fraction)) return '';
  return `${formatNumber(fraction * 100, maxFraction)}%`;
}
