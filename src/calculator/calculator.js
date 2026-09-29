import { getFeeScheme } from '../fees/feeSchemes.js';
import { platformFee } from '../fees/feeEngine.js';
import {
  sellingPriceFromROI,
  sellingPriceFromProfit,
  purchasePriceFromROI,
  purchasePriceFromProfit,
} from './solver.js';

export const MODES = Object.freeze({
  PROFIT: 'Profit',
  TARGET_SELLING: 'Target Selling Price',
  TARGET_PURCHASE: 'Target Purchase Price',
});

export const BOTH_TARGETS_WARNING = 'Enter either Target ROI or Target Profit — not both.';

// Blank cell => null. Anything that is not a finite number is treated as blank,
// so NaN / Infinity / undefined can never leak into a result.
const num = (x) => {
  if (x === null || x === undefined || x === '') return null;
  const n = typeof x === 'number' ? x : Number(String(x).trim());
  return Number.isFinite(n) && String(x).trim() !== '' ? n : null;
};

const EMPTY = Object.freeze({
  netRevenue: null,
  platformFee: null,
  totalCost: null,
  profit: null,
  profitMargin: null,
  roi: null,
  targetResult: null,
  targetLabel: '',
  effectivePurchasePrice: null,
  effectiveSellingPrice: null,
  warning: null,
});

/**
 * input:
 *   mode            'Profit' | 'Target Selling Price' | 'Target Purchase Price'   (C6)
 *   feeSchemeId     e.g. 'TP0045'                                                  (C7/C8)
 *   purchasePrice   number|null                                                    (C9)
 *   sellingPrice    number|null                                                    (C10)
 *   otherCosts      number|null                                                    (C11)
 *   targetRoi       fraction (0.75 = 75%) | null                                   (C12)
 *   targetProfit    number|null                                                    (C13)
 *
 * Returns every result as a number or null (null = blank / neutral).
 */
export function calculate(input = {}, opts = {}) {
  const mode = input.mode;
  const isTSP = mode === MODES.TARGET_SELLING;
  const isTPP = mode === MODES.TARGET_PURCHASE;
  const isProfit = mode === MODES.PROFIT;
  if (!isTSP && !isTPP && !isProfit) return { ...EMPTY };

  const feeId = getFeeScheme(input.feeSchemeId) ? input.feeSchemeId : null; // C8 (blank if unknown)
  const C9 = num(input.purchasePrice);
  const C10 = num(input.sellingPrice);
  const C11 = num(input.otherCosts);
  const C12 = num(input.targetRoi);
  const C13 = num(input.targetProfit);

  const result = { ...EMPTY };
  result.targetLabel = isTSP ? 'Recommended Selling Price' : isTPP ? 'Recommended Purchase Price' : '';

  // Both targets filled in a target mode: do not guess (Excel silently prefers ROI; the spec says warn).
  if ((isTSP || isTPP) && C12 !== null && C13 !== null) {
    result.warning = BOTH_TARGETS_WARNING;
    return result;
  }

  // ---- H12 — main calculation (blank cells are 0 when passed to VBA) ----
  let H12 = null;
  if (feeId) {
    if (isTSP) {
      if (C9 !== null) {
        if (C12 !== null) H12 = sellingPriceFromROI(feeId, C9, C11 ?? 0, C12, opts);
        else if (C13 !== null) H12 = sellingPriceFromProfit(feeId, C9, C11 ?? 0, C13, opts);
      }
    } else if (isTPP) {
      if (C10 !== null) {
        if (C12 !== null) H12 = purchasePriceFromROI(feeId, C10, C11 ?? 0, C12);
        else if (C13 !== null) H12 = purchasePriceFromProfit(feeId, C10, C11 ?? 0, C13);
      }
    }
  }
  result.targetResult = H12;

  // ---- H15 / H14 — effective prices ----
  const H15 = isTSP ? H12 : C10; // effective selling price
  const H14 = isTPP ? H12 : C9;  // effective purchase price
  result.effectiveSellingPrice = H15;
  result.effectivePurchasePrice = H14;

  // ---- H7 — platform fee ----
  let H7 = null;
  const feeBlank =
    !feeId ||
    (isProfit && C10 === null) ||
    (isTSP && H12 === null) ||
    (isTPP && C10 === null);
  if (!feeBlank) H7 = platformFee(feeId, H15);
  result.platformFee = H7;

  // ---- H6 — net revenue ----
  const H6 = H7 === null || H15 === null ? null : H15 - H7;
  result.netRevenue = H6;

  // ---- H8 — total cost ----
  let H8 = null;
  if (isTPP) {
    H8 = H12 === null ? null : H12 + (C11 ?? 0);
  } else if (C9 !== null && C11 !== null) {
    H8 = C9 + C11;
  }
  result.totalCost = H8;

  // ---- H9 — profit ----
  const H9 = H6 === null || H8 === null ? null : H6 - H8;
  result.profit = H9;

  // ---- H10 — profit margin (Profit / Net Revenue) ----
  result.profitMargin = H9 === null || H6 === null || H6 === 0 ? null : H9 / H6;

  // ---- H11 — ROI (Profit / Purchase Price) ----
  result.roi = H9 === null || H14 === null || H14 <= 0 ? null : H9 / H14;

  // Final safety net: nothing non-finite ever leaves this function.
  for (const k of Object.keys(result)) {
    if (typeof result[k] === 'number' && !Number.isFinite(result[k])) result[k] = null;
  }
  return result;
}
