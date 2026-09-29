// Display-only formatting (Indonesian style: 1.234.567,89). Never used in calculations.
const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function formatNumber(n, maxFraction = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '';
  const [int, frac = ''] = Math.abs(n).toFixed(maxFraction).split('.');
  const f = frac.replace(/0+$/, '');
  const negative = n < 0 && (Number(int) > 0 || f !== '');
  return `${negative ? '-' : ''}${group(int)}${f ? ',' + f : ''}`;
}

// "Rp 367.876" — whole rupiah for reading.
export function formatRupiah(n) {
  const s = formatNumber(n, 0);
  if (s === '') return '';
  return s.startsWith('-') ? `-Rp ${s.slice(1)}` : `Rp ${s}`;
}

// "Rp 367.875,65" — up to 2 decimals, to show the exact un-rounded figure.
export function formatRupiahExact(n) {
  const s = formatNumber(n, 2);
  if (s === '') return '';
  return s.startsWith('-') ? `-Rp ${s.slice(1)}` : `Rp ${s}`;
}
