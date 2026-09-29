import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRupiah, formatRupiahExact, formatNumber } from '../src/formatting/currency.js';
import { formatPercent } from '../src/formatting/percentage.js';
import { parseMoney, parsePercent, explainBlank } from '../src/validation/validation.js';
import { MODES } from '../src/calculator/calculator.js';

test('currency formatting (Indonesian style)', () => {
  assert.equal(formatRupiah(367_875.6476683938), 'Rp 367.876');
  assert.equal(formatRupiahExact(367_875.6476683938), 'Rp 367.875,65');
  assert.equal(formatRupiah(6_499_900), 'Rp 6.499.900');
  assert.equal(formatRupiah(-1500), '-Rp 1.500');
  assert.equal(formatRupiah(-0.2), 'Rp 0');
  assert.equal(formatRupiah(0), 'Rp 0');
  assert.equal(formatRupiah(NaN), '');
  assert.equal(formatNumber(1234.5, 2), '1.234,5');
});

test('percent formatting', () => {
  assert.equal(formatPercent(0.75), '75%');
  assert.equal(formatPercent(1.1761856481481483), '117,62%');
  assert.equal(formatPercent(null), '');
});

test('money parsing', () => {
  const v = (s) => parseMoney(s).value;
  assert.equal(v('6.499.900'), 6_499_900);
  assert.equal(v('6,499,900'), 6_499_900);
  assert.equal(v('Rp 250000'), 250_000);
  assert.equal(v('367875.65'), 367_875.65);
  assert.equal(v('367875,65'), 367_875.65);
  assert.equal(v('1.234.567,5'), 1_234_567.5);
  assert.equal(v('0'), 0);
  assert.equal(v('-5000'), -5000);
  assert.deepEqual(parseMoney(''), { value: null, invalid: false });
  assert.deepEqual(parseMoney('  '), { value: null, invalid: false });
  for (const bad of ['abc', '1.2.3', '12a', 'Infinity', '1e5', '--1']) {
    assert.deepEqual(parseMoney(bad), { value: null, invalid: true }, bad);
  }
});

test('percent parsing converts to a fraction', () => {
  assert.equal(parsePercent('75').value, 0.75);
  assert.equal(parsePercent('75%').value, 0.75);
  assert.equal(parsePercent('12,5').value, 0.125);
  assert.equal(parsePercent('-50').value, -0.5);
  assert.equal(parsePercent('').value, null);
  assert.equal(parsePercent('x').invalid, true);
});

test('explainBlank gives a plain reason', () => {
  const b = { purchase: null, selling: null, other: 0, roi: null, profit: null };
  assert.match(explainBlank(MODES.PROFIT, b), /purchase price and selling price/);
  assert.match(explainBlank(MODES.TARGET_SELLING, { ...b, purchase: 100 }), /target ROI or a target profit/);
  assert.match(explainBlank(MODES.TARGET_SELLING, { ...b, purchase: 0, roi: 0.5 }), /above Rp 0/);
  assert.match(explainBlank(MODES.TARGET_PURCHASE, { ...b, selling: 100, roi: -1 }), /−100%/);
  assert.equal(explainBlank(MODES.PROFIT, { ...b, purchase: 1, selling: 2 }), null);
});
