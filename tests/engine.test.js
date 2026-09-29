import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { FEE_SCHEMES, getFeeScheme } from '../src/fees/feeSchemes.js';
import { platformFee } from '../src/fees/feeEngine.js';
import {
  sellingPriceFromROI,
  sellingPriceFromProfit,
  purchasePriceFromROI,
  purchasePriceFromProfit,
} from '../src/calculator/solver.js';
import { calculate, MODES, BOTH_TARGETS_WARNING } from '../src/calculator/calculator.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(
    typeof actual === 'number' && Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`,
  );

// ---------------------------------------------------------------------------
// TEST-ONLY oracle: a tiny recursive-descent parser for the ORIGINAL Excel fee
// strings. Used to prove the explicit term table was transcribed correctly.
// It is never imported by src/ and never uses eval().
// ---------------------------------------------------------------------------
function oracle(formula, gross) {
  const src = formula.replace(/\s+/g, '');
  let pos = 0;
  const peek = () => src[pos];
  const number = () => {
    const m = /^\d+(\.\d+)?/.exec(src.slice(pos));
    if (!m) throw new Error(`bad number at ${pos} in ${src}`);
    pos += m[0].length;
    return parseFloat(m[0]);
  };
  function primary() {
    if (peek() === '(') { pos++; const v = expr(); pos++; return v; }
    if (src.startsWith('min(', pos)) {
      pos += 4; const a = expr(); pos++; const b = expr(); pos++;
      return Math.min(a, b);
    }
    if (src.startsWith('GrossPrice', pos)) { pos += 10; return gross; }
    let v = number();
    while (peek() === '%') { pos++; v = v / 100; }
    return v;
  }
  function term() {
    let v = primary();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++]; const r = primary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++]; const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const out = expr();
  if (pos !== src.length) throw new Error(`trailing input in ${src}`);
  return out;
}

// ---------------------------------------------------------------------------
// Phase 1 — Fee engine
// ---------------------------------------------------------------------------
test('fee table: IDs are unique and the full list is present', () => {
  const ids = FEE_SCHEMES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  // 47 TP + 5 SP + DIRECT / TC0001 / LELANG = 55, exactly the spec's list
  const expected = [
    ...Array.from({ length: 47 }, (_, i) => `TP${String(i + 1).padStart(4, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `SP${String(i + 1).padStart(4, '0')}`),
    'DIRECT', 'TC0001', 'LELANG',
  ];
  assert.equal(ids.length, 55);
  assert.deepEqual([...ids].sort(), [...expected].sort());
});

test('fee engine: EVERY scheme matches an independent parse of its Excel formula text', () => {
  const grosses = [0, 1, 999, 10_000, 100_000, 249_999, 350_000, 400_000, 499_999, 500_000,
    500_001, 899_999, 900_000, 1_000_000, 3_000_000, 6_499_900, 21_666_666.67, 30_000_000,
    250_000_000, 1e9, 367_875.6476683938];
  for (const s of FEE_SCHEMES) {
    for (const g of grosses) {
      const got = platformFee(s.id, g);
      const want = oracle(s.formula, g);
      near(got, want, Math.max(1e-9, Math.abs(want) * 1e-12), `${s.id} @ ${g}`);
    }
  }
});

test('fee engine: worked examples from the spec', () => {
  assert.equal(platformFee('TP0001', 350_000), 12_250);
  assert.equal(platformFee('TP0045', 6_499_900), 813_737.5);
});

test('fee engine: caps', () => {
  // TP0001 cap Rp10,000: 1% + min(2.5%, 10k)
  assert.equal(platformFee('TP0001', 1_000_000), 10_000 + 10_000);
  assert.equal(platformFee('TP0001', 400_000), 4_000 + 10_000);       // 2.5% = 10,000 exactly
  near(platformFee('TP0001', 300_000), 3_000 + 7_500, 1e-9);           // below cap
  // TP0045 cap Rp650,000 (3% > 650k when gross > 21,666,666.67)
  near(platformFee('TP0045', 30_000_000), 2_850_000 + 650_000 + 1_250, 1e-6);
  near(platformFee('TP0045', 10_000_000), 950_000 + 300_000 + 1_250, 1e-6); // below cap
  // TP0046 cap Rp80,000 (3% > 80k when gross > 2,666,666.67)
  near(platformFee('TP0046', 3_000_000), 285_000 + 80_000 + 3_030 + 1_250, 1e-6);
  near(platformFee('TP0046', 1_000_000), 95_000 + 30_000 + 3_030 + 1_250, 1e-6);
  // TP0047 cap Rp650,000
  near(platformFee('TP0047', 30_000_000), 2_850_000 + 900_000 + 650_000 + 1_250, 1e-6);
  near(platformFee('TP0047', 10_000_000), 950_000 + 300_000 + 300_000 + 1_250, 1e-6);
});

test('fee engine: zero-fee schemes', () => {
  for (const id of ['DIRECT', 'TC0001', 'LELANG', 'SP0001']) {
    for (const g of [0, 1, 350_000, 6_499_900]) assert.equal(platformFee(id, g), 0, id);
  }
});

test('fee engine: Excel edge cases are preserved (no clamping, constants stay constants)', () => {
  near(platformFee('TP0007', 400_000), 0.015 * (400_000 - 500_000), 1e-9); // negative fee, like Excel
  near(platformFee('TP0029', 500_000), 0.038 * (500_000 - 900_000), 1e-9);
  near(platformFee('TP0007', 1_500_000), 15_000, 1e-9);
  assert.equal(platformFee('TP0032', 1), 10_000 / 6);
  assert.equal(platformFee('TP0032', 9_999_999), 10_000 / 6);
});

test('fee engine: bad input returns null, never NaN', () => {
  for (const g of [NaN, Infinity, -Infinity, undefined, null, '350000']) {
    assert.equal(platformFee('TP0001', g), null);
  }
  assert.equal(platformFee('NOPE', 100_000), null);
  assert.equal(platformFee(undefined, 100_000), null);
});

test('no eval / Function anywhere in src/', () => {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
  for (const f of walk(new URL('../src', import.meta.url).pathname).filter((f) => f.endsWith('.js'))) {
    const code = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/\beval\s*\(/.test(code), `${f} uses eval`);
    assert.ok(!/new\s+Function\s*\(/.test(code), `${f} uses new Function`);
  }
});

// ---------------------------------------------------------------------------
// Phases 2–6 — Calculator / solvers
// ---------------------------------------------------------------------------
test('Profit mode: live TP0045 regression (Excel values)', () => {
  const r = calculate({
    mode: MODES.PROFIT, feeSchemeId: 'TP0045',
    purchasePrice: 2_612_903.2258064514, sellingPrice: 6_499_900, otherCosts: 0,
  });
  near(r.platformFee, 813_737.5, 1e-6, 'fee');
  near(r.netRevenue, 5_686_162.5, 1e-6, 'net revenue');
  near(r.totalCost, 2_612_903.2258064514, 1e-6, 'total cost');
  near(r.profit, 3_073_259.2741935486, 1e-6, 'profit');
  near(r.profitMargin, 0.5404803809587835, 1e-12, 'margin');
  near(r.roi, 1.1761856481481483, 1e-12, 'roi');
  assert.equal(r.effectivePurchasePrice, 2_612_903.2258064514);
  assert.equal(r.effectiveSellingPrice, 6_499_900);
  assert.equal(r.warning, null);
});

test('Target Selling Price from ROI: TP0001 / 200,000 / 5,000 / 75%', () => {
  const r = calculate({
    mode: MODES.TARGET_SELLING, feeSchemeId: 'TP0001',
    purchasePrice: 200_000, otherCosts: 5_000, targetRoi: 0.75,
  });
  near(r.targetResult, 367_875.65, 0.01, 'selling price');
  assert.equal(r.targetLabel, 'Recommended Selling Price');
  // Fee at that price under TP0001 is 3.5% (2.5% is still under the 10k cap): 355,000/0.965 * 3.5%
  near(r.platformFee, 12_875.65, 0.01, 'fee');
  near(r.roi, 0.75, 1e-9, 'roi hits target');
  near(r.profit, 150_000, 1e-4, 'profit = 75% * 200,000');
  near(r.totalCost, 205_000, 1e-9, 'total cost');
  near(r.effectiveSellingPrice, r.targetResult, 0);
});

test('Target Purchase Price from ROI: inverse of the TP0001 test', () => {
  const r = calculate({
    mode: MODES.TARGET_PURCHASE, feeSchemeId: 'TP0001',
    sellingPrice: 367_875.65, otherCosts: 5_000, targetRoi: 0.75,
  });
  near(r.targetResult, 200_000, 0.01, 'purchase price');
  assert.equal(r.targetLabel, 'Recommended Purchase Price');
  near(r.roi, 0.75, 1e-9, 'roi hits target');
  // exact round trip through the solvers
  const s = sellingPriceFromROI('TP0001', 200_000, 5_000, 0.75);
  near(purchasePriceFromROI('TP0001', s, 5_000, 0.75), 200_000, 1e-6, 'round trip');
});

test('Target Profit: selling price and purchase price', () => {
  // Selling: need net 305,000 => 305,000 / 0.965
  const sp = sellingPriceFromProfit('TP0001', 200_000, 5_000, 100_000);
  near(sp, 305_000 / 0.965, 1e-6, 'selling from profit');
  const r1 = calculate({
    mode: MODES.TARGET_SELLING, feeSchemeId: 'TP0001',
    purchasePrice: 200_000, otherCosts: 5_000, targetProfit: 100_000,
  });
  near(r1.profit, 100_000, 1e-4, 'profit hits target');

  // Purchase: 350,000 - 12,250 - 5,000 - 50,000 = 282,750
  assert.equal(purchasePriceFromProfit('TP0001', 350_000, 5_000, 50_000), 282_750);
  const r2 = calculate({
    mode: MODES.TARGET_PURCHASE, feeSchemeId: 'TP0001',
    sellingPrice: 350_000, otherCosts: 5_000, targetProfit: 50_000,
  });
  assert.equal(r2.targetResult, 282_750);
  near(r2.profit, 50_000, 1e-9, 'profit');
  near(r2.roi, 50_000 / 282_750, 1e-12, 'roi');
});

test('Target Purchase Price with ROI is the direct formula', () => {
  // (350,000 - 12,250 - 5,000) / 1.5
  near(purchasePriceFromROI('TP0001', 350_000, 5_000, 0.5), 332_750 / 1.5, 1e-9);
});

test('Target modes: both ROI and Profit => warning, blank result (no guessing)', () => {
  for (const mode of [MODES.TARGET_SELLING, MODES.TARGET_PURCHASE]) {
    const r = calculate({
      mode, feeSchemeId: 'TP0001', purchasePrice: 200_000, sellingPrice: 350_000,
      otherCosts: 0, targetRoi: 0.5, targetProfit: 10_000,
    });
    assert.equal(r.warning, BOTH_TARGETS_WARNING);
    assert.equal(r.targetResult, null);
  }
  // Profit mode ignores the target fields entirely
  const p = calculate({
    mode: MODES.PROFIT, feeSchemeId: 'TP0001', purchasePrice: 200_000, sellingPrice: 350_000,
    otherCosts: 0, targetRoi: 0.5, targetProfit: 10_000,
  });
  assert.equal(p.warning, null);
  assert.equal(p.platformFee, 12_250);
});

// ---------------------------------------------------------------------------
// Bracket check — the one place the VBA is not safe
// ---------------------------------------------------------------------------
test('VBA upper bound: strict Excel bracket under-shoots; default widens and is correct', () => {
  // The user's own live TP0045 example, run in reverse: what selling price gives ROI 117.6%?
  // Answer must be ~6,499,900. The VBA bracket tops out at 2,612,903 + 0 + 1,000,000.
  const P = 2_612_903.2258064514;
  const roi = 1.1761856481481483;

  const strict = sellingPriceFromROI('TP0045', P, 0, roi, { strictExcelBounds: true });
  near(strict, P + 1_000_000, 1e-3, 'strict returns the bracket ceiling, not the answer');

  const fixed = sellingPriceFromROI('TP0045', P, 0, roi);
  near(fixed, 6_499_900, 1e-3, 'default finds the real answer');
});

test('VBA upper bound: when Excel is right, default is bit-identical to strict', () => {
  const cases = [
    ['TP0001', 200_000, 5_000, 0.75],
    ['TP0045', 500_000, 0, 0.3],
    ['SP0004', 1_000_000, 25_000, 0.1],
    ['DIRECT', 100_000, 0, 0.2],
  ];
  for (const [id, p, o, r] of cases) {
    assert.equal(
      sellingPriceFromROI(id, p, o, r),
      sellingPriceFromROI(id, p, o, r, { strictExcelBounds: true }),
      `${id} ROI`,
    );
  }
  assert.equal(
    sellingPriceFromProfit('TP0001', 200_000, 5_000, 100_000),
    sellingPriceFromProfit('TP0001', 200_000, 5_000, 100_000, { strictExcelBounds: true }),
  );
});

test('Target Selling Price finds the answer for a large purchase price + high ROI (TP0045)', () => {
  const r = calculate({
    mode: MODES.TARGET_SELLING, feeSchemeId: 'TP0045',
    purchasePrice: 2_612_903.2258064514, otherCosts: 0, targetRoi: 1.1761856481481483,
  });
  near(r.targetResult, 6_499_900, 1e-3);
  near(r.platformFee, 813_737.5, 1e-3);
  near(r.roi, 1.1761856481481483, 1e-9);
});

// ---------------------------------------------------------------------------
// Validation / graceful behaviour
// ---------------------------------------------------------------------------
test('solver validation mirrors the VBA', () => {
  assert.equal(sellingPriceFromROI('TP0001', 0, 0, 0.5), null);      // purchase <= 0
  assert.equal(sellingPriceFromROI('TP0001', -5, 0, 0.5), null);
  assert.equal(sellingPriceFromProfit('TP0001', -1, 0, 100), null);  // purchase < 0
  assert.equal(sellingPriceFromProfit('TP0001', 100, 0, -1), null);  // target profit < 0
  assert.ok(sellingPriceFromProfit('TP0001', 0, 0, 100) > 0);        // purchase = 0 is allowed
  assert.equal(purchasePriceFromROI('TP0001', 0, 0, 0.5), null);     // selling <= 0
  assert.equal(purchasePriceFromROI('TP0001', 100_000, 0, -1), null);// ROI <= -100%
  assert.equal(purchasePriceFromROI('TP0001', 100_000, 0, -2), null);
  assert.equal(purchasePriceFromProfit('TP0001', 0, 0, 100), null);  // selling <= 0
  assert.equal(sellingPriceFromROI('BOGUS', 100_000, 0, 0.5), null); // unknown fee
});

const BLANKISH = [null, undefined, '', 'abc', NaN, Infinity, -Infinity, '  '];
const VALUES = [...BLANKISH, 0, -1, 1, 0.5, 100_000, '250000', 6_499_900, 1e15];

test('no NaN / Infinity / undefined ever leaves calculate() (exhaustive fuzz)', () => {
  let checked = 0;
  for (const mode of [...Object.values(MODES), '', undefined, 'Nonsense']) {
    for (const feeSchemeId of ['TP0001', 'TP0045', 'TP0007', 'DIRECT', '', undefined, 'NOPE']) {
      for (const purchasePrice of VALUES) {
        for (const sellingPrice of VALUES) {
          for (const otherCosts of [null, 0, 5_000, -1e6]) {
            for (const [targetRoi, targetProfit] of [[null, null], [0.75, null], [null, 50_000], [-1, null], [null, -5], [0.5, 1]]) {
              const r = calculate({ mode, feeSchemeId, purchasePrice, sellingPrice, otherCosts, targetRoi, targetProfit });
              for (const [k, v] of Object.entries(r)) {
                if (k === 'warning' || k === 'targetLabel') continue;
                assert.ok(v === null || (typeof v === 'number' && Number.isFinite(v)), `${k}=${v}`);
              }
              checked++;
            }
          }
        }
      }
    }
  }
  assert.ok(checked > 10_000);
});

test('missing input => blank (null) results, not fabricated numbers', () => {
  const blank = { mode: MODES.PROFIT, feeSchemeId: 'TP0001' };
  const r = calculate(blank);
  for (const k of ['netRevenue', 'platformFee', 'totalCost', 'profit', 'profitMargin', 'roi']) {
    assert.equal(r[k], null, k);
  }
  // Target Selling Price without a purchase price
  const t = calculate({ mode: MODES.TARGET_SELLING, feeSchemeId: 'TP0001', targetRoi: 0.5, otherCosts: 0 });
  assert.equal(t.targetResult, null);
  assert.equal(t.platformFee, null);
  // Target mode with no target entered
  const u = calculate({ mode: MODES.TARGET_SELLING, feeSchemeId: 'TP0001', purchasePrice: 100_000, otherCosts: 0 });
  assert.equal(u.targetResult, null);
  // No fee scheme
  const v = calculate({ mode: MODES.PROFIT, purchasePrice: 1, sellingPrice: 2, otherCosts: 0 });
  assert.equal(v.platformFee, null);
});

test('Excel parity: blank Other Costs blanks Total Cost / Profit in Profit mode (workbook H8)', () => {
  const r = calculate({ mode: MODES.PROFIT, feeSchemeId: 'TP0001', purchasePrice: 200_000, sellingPrice: 350_000 });
  assert.equal(r.platformFee, 12_250);
  assert.equal(r.netRevenue, 337_750);
  assert.equal(r.totalCost, null);
  assert.equal(r.profit, null);
  const z = calculate({ mode: MODES.PROFIT, feeSchemeId: 'TP0001', purchasePrice: 200_000, sellingPrice: 350_000, otherCosts: 0 });
  assert.equal(z.profit, 137_750);
  assert.equal(z.profitMargin, 137_750 / 337_750);
  assert.equal(z.roi, 137_750 / 200_000);
});

test('ROI and Profit Margin use different denominators', () => {
  const r = calculate({ mode: MODES.PROFIT, feeSchemeId: 'DIRECT', purchasePrice: 100_000, sellingPrice: 150_000, otherCosts: 0 });
  assert.equal(r.roi, 0.5);                  // 50,000 / purchase
  near(r.profitMargin, 50_000 / 150_000, 1e-15); // 50,000 / net revenue
});

test('no hidden rounding of calculated prices', () => {
  const s = sellingPriceFromROI('TP0001', 200_000, 5_000, 0.75);
  assert.notEqual(s, Math.round(s));
  assert.notEqual(s % 1, 0);
});
