import { platformFee } from '../fees/feeEngine.js';

// Ports of the VBA functions. Every function returns a number, or null where the
// VBA returns an error (which the workbook turns into "" via IFERROR).
// Inputs are plain numbers (blank cells are passed as 0 by the caller, as VBA does).
// TargetROI is a fraction (0.75 = 75%).

const ITERATIONS = 100;
const BRACKET_PAD = 1_000_000;
const MAX_DOUBLINGS = 60;

const ok = (...xs) => xs.every((x) => typeof x === 'number' && Number.isFinite(x));

// Shared binary search. `profitAtPrice(p)` must be non-decreasing in p.
// `met(p)` is the VBA's "if X < Target then Low = Mid else High = Mid" test inverted:
// the VBA moves Low up while the metric is BELOW target.
//
// Excel-parity note: the workbook's initial upper bound (Purchase + Other + 1,000,000
// [+ TargetProfit]) is not always high enough. When it isn't, the VBA silently returns
// that bound as if it were the answer. By default we keep the VBA bracket exactly and
// only widen it when the target is NOT reachable inside it (so results are identical
// to Excel wherever Excel is right). Pass { strictExcelBounds: true } for raw VBA behaviour.
function bisect(belowTarget, initialHigh, strictExcelBounds) {
  let low = 0;
  let high = initialHigh;

  if (!strictExcelBounds) {
    let n = 0;
    while (belowTarget(high) === true) {
      if (++n > MAX_DOUBLINGS) return null;
      high = high > 0 ? high * 2 : BRACKET_PAD;
    }
  }

  for (let i = 1; i <= ITERATIONS; i++) {
    const mid = (low + high) / 2;
    const below = belowTarget(mid);
    if (below === null) return null;
    if (below) low = mid;
    else high = mid;
  }
  return high;
}

export function sellingPriceFromROI(feeId, purchasePrice, otherCosts, targetROI, opts = {}) {
  if (!ok(purchasePrice, otherCosts, targetROI)) return null;
  if (purchasePrice <= 0) return null;

  const belowTarget = (p) => {
    const fee = platformFee(feeId, p);
    if (fee === null) return null;
    const profit = p - fee - purchasePrice - otherCosts;
    return profit / purchasePrice < targetROI;
  };
  return bisect(belowTarget, purchasePrice + otherCosts + BRACKET_PAD, !!opts.strictExcelBounds);
}

export function sellingPriceFromProfit(feeId, purchasePrice, otherCosts, targetProfit, opts = {}) {
  if (!ok(purchasePrice, otherCosts, targetProfit)) return null;
  if (purchasePrice < 0) return null;
  if (targetProfit < 0) return null;

  const belowTarget = (p) => {
    const fee = platformFee(feeId, p);
    if (fee === null) return null;
    return p - fee - purchasePrice - otherCosts < targetProfit;
  };
  return bisect(
    belowTarget,
    purchasePrice + otherCosts + targetProfit + BRACKET_PAD,
    !!opts.strictExcelBounds,
  );
}

// Direct formula (NOT a search), same as the VBA.
export function purchasePriceFromROI(feeId, sellingPrice, otherCosts, targetROI) {
  if (!ok(sellingPrice, otherCosts, targetROI)) return null;
  if (sellingPrice <= 0) return null;
  if (targetROI <= -1) return null;

  const fee = platformFee(feeId, sellingPrice);
  if (fee === null) return null;

  const netAfterFee = sellingPrice - fee - otherCosts;
  return netAfterFee / (1 + targetROI);
}

// Direct formula, same as the VBA.
export function purchasePriceFromProfit(feeId, sellingPrice, otherCosts, targetProfit) {
  if (!ok(sellingPrice, otherCosts, targetProfit)) return null;
  if (sellingPrice <= 0) return null;

  const fee = platformFee(feeId, sellingPrice);
  if (fee === null) return null;

  return sellingPrice - fee - otherCosts - targetProfit;
}
