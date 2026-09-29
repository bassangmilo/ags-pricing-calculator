import { calculate, MODES } from '../calculator/calculator.js';
import { FEE_SCHEMES, getFeeScheme } from '../fees/feeSchemes.js';
import { formatRupiah, formatRupiahExact } from '../formatting/currency.js';
import { formatPercent } from '../formatting/percentage.js';
import { parseMoney, parsePercent, explainBlank } from '../validation/validation.js';

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const fields = {
  purchase: { el: $('purchase'), hint: $('hint-purchase'), parse: parseMoney, fmt: formatRupiahExact },
  selling:  { el: $('selling'),  hint: $('hint-selling'),  parse: parseMoney, fmt: formatRupiahExact },
  other:    { el: $('other'),    hint: $('hint-other'),    parse: parseMoney, fmt: formatRupiahExact },
  roi:      { el: $('roi'),      hint: $('hint-roi'),      parse: parsePercent, fmt: (f) => formatPercent(f, 4) },
  profit:   { el: $('tprofit'),  hint: $('hint-tprofit'),  parse: parseMoney, fmt: formatRupiahExact },
};

let mode = Object.values(MODES).includes(store.get('ags.mode')) ? store.get('ags.mode') : MODES.PROFIT;

// Fee scheme dropdown
$('fee').innerHTML = FEE_SCHEMES.map((s) => `<option value="${s.id}">${s.id}</option>`).join('');
const savedFee = store.get('ags.fee');
$('fee').value = getFeeScheme(savedFee) ? savedFee : 'TP0001';

function applyMode() {
  document.querySelectorAll('#modes button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.mode === mode)));
  document.querySelectorAll('[data-for]').forEach((n) => {
    n.hidden = !n.dataset.for.split(',').includes(mode);
  });
  $('row-profit').hidden = mode === MODES.PROFIT; // Profit is already the headline in Profit mode
}

function render() {
  const parsed = {};
  for (const [k, f] of Object.entries(fields)) {
    const p = f.parse(f.el.value);
    parsed[k] = p;
    f.el.closest('.box').classList.toggle('bad', p.invalid);
    f.hint.classList.toggle('bad', p.invalid);
    f.hint.textContent = p.invalid ? 'Not a number' : p.value === null ? '' : f.fmt(p.value);
  }
  const v = Object.fromEntries(Object.entries(parsed).map(([k, p]) => [k, p.value]));
  const feeId = $('fee').value;
  $('fee-formula').textContent = getFeeScheme(feeId)?.formula.replaceAll('GrossPrice', 'price') ?? '';

  const r = calculate({
    mode, feeSchemeId: feeId,
    purchasePrice: v.purchase, sellingPrice: v.selling, otherCosts: v.other,
    targetRoi: v.roi, targetProfit: v.profit,
  });

  const banner = $('banner');
  banner.hidden = !r.warning;
  banner.textContent = r.warning ?? '';

  const isProfit = mode === MODES.PROFIT;
  const main = isProfit ? r.profit : r.targetResult;
  $('main-label').textContent = isProfit ? 'Profit' : r.targetLabel;
  $('main-value').textContent = main === null ? '—' : formatRupiah(main);
  const exact = main === null ? '' : formatRupiahExact(main);
  $('main-exact').textContent = exact && exact !== formatRupiah(main) ? `Exact: ${exact}` : '';

  let note = '';
  if (r.warning) note = '';
  else if (main === null) note = explainBlank(mode, v) ?? '';
  else if (mode === MODES.TARGET_PURCHASE && main < 0) note = 'Negative: this target can’t be met at this selling price.';
  $('main-note').textContent = note;

  const money = (n) => (n === null ? '—' : formatRupiah(n));
  $('r-fee').textContent = money(r.platformFee);
  $('r-net').textContent = money(r.netRevenue);
  $('r-cost').textContent = money(r.totalCost);
  $('r-profit').textContent = money(r.profit);
  $('r-margin').textContent = r.profitMargin === null ? '—' : formatPercent(r.profitMargin);
  $('r-roi').textContent = r.roi === null ? '—' : formatPercent(r.roi);
}

document.querySelectorAll('#modes button').forEach((b) =>
  b.addEventListener('click', () => { mode = b.dataset.mode; store.set('ags.mode', mode); applyMode(); render(); }));
Object.values(fields).forEach((f) => f.el.addEventListener('input', render));
$('fee').addEventListener('change', () => { store.set('ags.fee', $('fee').value); render(); });
$('clear').addEventListener('click', () => {
  Object.values(fields).forEach((f) => { f.el.value = ''; });
  fields.other.el.value = '0';
  render();
});

applyMode();
render();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
