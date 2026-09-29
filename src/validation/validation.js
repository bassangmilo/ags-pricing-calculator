import { MODES } from '../calculator/calculator.js';

const strip = (s) => String(s ?? '').replace(/rp/gi, '').replace(/\s/g, '');
const PLAIN = /^[-+]?(\d+\.?\d*|\.\d+)$/;

// Money: "6.499.900" or "6,499,900" (thousands), "367875.65" / "367875,65" (decimal).
// -> { value: number|null, invalid: boolean }   (blank => value null, invalid false)
export function parseMoney(text) {
  let t = strip(text);
  if (t === '') return { value: null, invalid: false };
  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  if (!PLAIN.test(t)) return { value: null, invalid: true };
  const n = Number(t);
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

// Percent typed as "75" or "12,5" or "75%" -> fraction 0.75
export function parsePercent(text) {
  const t = strip(text).replace('%', '').replace(',', '.');
  if (t === '') return { value: null, invalid: false };
  if (!PLAIN.test(t)) return { value: null, invalid: true };
  const n = Number(t) / 100;
  return Number.isFinite(n) ? { value: n, invalid: false } : { value: null, invalid: true };
}

// Plain-language reason a result is blank (null when nothing is wrong / nothing to say).
// `v` holds parsed values: purchase, selling, other, roi (fraction), profit (all number|null).
export function explainBlank(mode, v) {
  const has = (x) => x !== null && x !== undefined;
  if (mode === MODES.PROFIT) {
    if (!has(v.purchase) || !has(v.selling)) return 'Enter the purchase price and selling price.';
    return null;
  }
  if (mode === MODES.TARGET_SELLING) {
    if (!has(v.purchase)) return 'Enter the purchase price.';
    if (!has(v.roi) && !has(v.profit)) return 'Enter a target ROI or a target profit.';
    if (has(v.roi) && v.purchase <= 0) return 'Purchase price must be above Rp 0 to use a target ROI.';
    if (!has(v.roi) && v.purchase < 0) return 'Purchase price can’t be negative.';
    if (!has(v.roi) && v.profit < 0) return 'Target profit can’t be negative.';
    return null;
  }
  if (mode === MODES.TARGET_PURCHASE) {
    if (!has(v.selling)) return 'Enter the selling price.';
    if (v.selling <= 0) return 'Selling price must be above Rp 0.';
    if (!has(v.roi) && !has(v.profit)) return 'Enter a target ROI or a target profit.';
    if (has(v.roi) && v.roi <= -1) return 'Target ROI must be above −100%.';
    return null;
  }
  return null;
}
