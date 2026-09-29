import { getFeeScheme } from './feeSchemes.js';

// Equivalent of the VBA PlatformFee(FormulaText, GrossPrice), driven by the
// explicit term table in feeSchemes.js instead of Evaluate()/eval().
// Returns a number, or null where Excel would return an error (-> IFERROR -> "").
export function platformFee(schemeId, grossPrice) {
  const scheme = getFeeScheme(schemeId);
  if (!scheme) return null;
  if (typeof grossPrice !== 'number' || !Number.isFinite(grossPrice)) return null;

  let fee = 0;
  for (const t of scheme.terms) {
    switch (t.type) {
      case 'pct':  fee += (t.rate / 100) * grossPrice; break;
      case 'cap':  fee += Math.min((t.rate / 100) * grossPrice, t.max); break;
      case 'over': fee += (t.rate / 100) * (grossPrice - t.threshold); break;
      case 'flat': fee += t.value; break;
      default: return null;
    }
  }
  return Number.isFinite(fee) ? fee : null;
}
