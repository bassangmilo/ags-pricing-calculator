// AGS fee schemes — the ONLY place fee formulas are defined.
//
// Each scheme is a list of additive terms, evaluated left-to-right (same order
// as the Excel formula text). `formula` is the original Excel text kept purely
// as documentation / for test cross-checking. It is never evaluated at runtime.
//
// Term builders (rates are written as percentages, exactly as in Excel: 2.5 = 2.5%):
//   pct(r)          r% * GrossPrice
//   cap(r, max)     min(r% * GrossPrice, max)
//   over(r, t)      r% * (GrossPrice - t)      (NOT clamped at 0 — matches Excel)
//   flat(v)         constant v

export const pct = (rate) => ({ type: 'pct', rate });
export const cap = (rate, max) => ({ type: 'cap', rate, max });
export const over = (rate, threshold) => ({ type: 'over', rate, threshold });
export const flat = (value) => ({ type: 'flat', value });

const S = (id, formula, terms) => Object.freeze({ id, formula, terms: Object.freeze(terms) });

export const FEE_SCHEMES = Object.freeze([
  S('TP0001', '1%*GrossPrice+min(2.5%*GrossPrice,10000)', [pct(1), cap(2.5, 10000)]),
  S('TP0002', '1%*GrossPrice', [pct(1)]),
  S('TP0003', '1.25%*GrossPrice+min(2.25%*GrossPrice,10000)', [pct(1.25), cap(2.25, 10000)]),
  S('TP0004', '1.25%*GrossPrice', [pct(1.25)]),
  S('TP0005', '1.5%*GrossPrice+min(1.5%*GrossPrice,10000)', [pct(1.5), cap(1.5, 10000)]),
  S('TP0006', '1.5%*GrossPrice', [pct(1.5)]),
  S('TP0007', '1.5%*(GrossPrice-500000)', [over(1.5, 500000)]),
  S('SP0001', '0', []),
  S('TP0008', '2.5%*GrossPrice+min(1.5%*GrossPrice,10000)', [pct(2.5), cap(1.5, 10000)]),
  S('TP0009', '2.5%*GrossPrice', [pct(2.5)]),
  S('TP0010', '1.75%*GrossPrice+min(1.5%*GrossPrice,10000)', [pct(1.75), cap(1.5, 10000)]),
  S('TP0011', '1.75%*GrossPrice', [pct(1.75)]),
  S('TP0012', '2.25%*GrossPrice+min(1.5%*GrossPrice,10000)', [pct(2.25), cap(1.5, 10000)]),
  S('TP0013', '2.25%*GrossPrice', [pct(2.25)]),
  S('TP0014', '1.85%*GrossPrice', [pct(1.85)]),
  S('TP0015', '2.5%*GrossPrice+min(2.5%*GrossPrice,10000)', [pct(2.5), cap(2.5, 10000)]),
  S('TP0016', '1.75%*GrossPrice+min(2.5%*GrossPrice,10000)', [pct(1.75), cap(2.5, 10000)]),
  S('TP0017', '3.1%*GrossPrice+min(4%*GrossPrice,10000)', [pct(3.1), cap(4, 10000)]),
  S('TP0018', '3.1%*GrossPrice+min(4%*GrossPrice,9000)', [pct(3.1), cap(4, 9000)]),
  S('TP0019', '3.1%*GrossPrice', [pct(3.1)]),
  S('TP0020', '3.8%*GrossPrice+min(4%*GrossPrice,10000)', [pct(3.8), cap(4, 10000)]),
  S('TP0021', '3.8%*GrossPrice+min(4%*GrossPrice,9000)', [pct(3.8), cap(4, 9000)]),
  S('TP0022', '3.8%*GrossPrice', [pct(3.8)]),
  S('TP0023', '1.5%*GrossPrice+min(1.9%*GrossPrice,10000)', [pct(1.5), cap(1.9, 10000)]),
  S('TP0024', '3.1%*GrossPrice+min(1.9%*GrossPrice,10000)', [pct(3.1), cap(1.9, 10000)]),
  S('TP0025', '3.1%*GrossPrice+min(1%*GrossPrice,10000)', [pct(3.1), cap(1, 10000)]),
  S('DIRECT', '0', []),
  S('TP0026', '3.8%*GrossPrice+min(1.28%*GrossPrice,10000)', [pct(3.8), cap(1.28, 10000)]),
  S('TP0027', '3.1%*GrossPrice+min(1.28%*GrossPrice,10000)', [pct(3.1), cap(1.28, 10000)]),
  S('TP0028', 'min(4%*GrossPrice,10000)', [cap(4, 10000)]),
  S('TP0029', '3.8%*(GrossPrice-900000)', [over(3.8, 900000)]),
  S('SP0002', '0.5%*GrossPrice', [pct(0.5)]),
  S('TP0030', '5.5%*GrossPrice+min(4%*GrossPrice,10000)', [pct(5.5), cap(4, 10000)]),
  S('TP0031', '5.5%*GrossPrice', [pct(5.5)]),
  S('TP0032', '10000/6', [flat(10000 / 6)]),
  S('TP0033', '7.5%*GrossPrice+min(4%*GrossPrice,10000)', [pct(7.5), cap(4, 10000)]),
  S('TP0034', '7.5%*GrossPrice+min(4%*GrossPrice,20000)', [pct(7.5), cap(4, 20000)]),
  S('TC0001', '0', []),
  S('TP0035', '7.5%*GrossPrice+min(6%*GrossPrice,40000)', [pct(7.5), cap(6, 40000)]),
  S('TP0036', '7.5%*GrossPrice+min(4%*GrossPrice,40000)', [pct(7.5), cap(4, 40000)]),
  S('TP0037', '7.5%*GrossPrice+min(4%*GrossPrice,40000)+1250', [pct(7.5), cap(4, 40000), flat(1250)]),
  S('TP0038', '7.5%*GrossPrice+min(4%*GrossPrice,40000)+1250/3', [pct(7.5), cap(4, 40000), flat(1250 / 3)]),
  S('TP0039', '7.5%*GrossPrice+min(4%*GrossPrice,40000)+1250+10000+10000', [pct(7.5), cap(4, 40000), flat(1250), flat(10000), flat(10000)]),
  S('TP0040', '7.5%*GrossPrice+min(4%*GrossPrice,40000)+1250+4.5%*GrossPrice', [pct(7.5), cap(4, 40000), flat(1250), pct(4.5)]),
  S('TP0041', '7.5%*GrossPrice+min(4%*GrossPrice,40000)+1250+3.5%*GrossPrice', [pct(7.5), cap(4, 40000), flat(1250), pct(3.5)]),
  S('LELANG', '0', []),
  S('TP0042', '9.5%*GrossPrice+min(4%*GrossPrice,40000)+1250', [pct(9.5), cap(4, 40000), flat(1250)]),
  S('TP0043', '9.5%*GrossPrice+min(4%*GrossPrice,45000)+1250', [pct(9.5), cap(4, 45000), flat(1250)]),
  S('TP0044', '9.5%*GrossPrice+min(3%*GrossPrice,45000)+1250', [pct(9.5), cap(3, 45000), flat(1250)]),
  S('TP0045', '9.5%*GrossPrice+min(3%*GrossPrice,650000)+1250', [pct(9.5), cap(3, 650000), flat(1250)]),
  S('SP0003', '9.5%*GrossPrice+0.5%*GrossPrice+1250', [pct(9.5), pct(0.5), flat(1250)]),
  S('SP0004', '9.5%*GrossPrice+1250', [pct(9.5), flat(1250)]),
  S('TP0046', '9.5%*GrossPrice+min(3%*GrossPrice,80000)+3030+1250', [pct(9.5), cap(3, 80000), flat(3030), flat(1250)]),
  S('TP0047', '9.5%*GrossPrice+3%*GrossPrice+min(3%*GrossPrice,650000)+1250', [pct(9.5), pct(3), cap(3, 650000), flat(1250)]),
  S('SP0005', '9.5%*GrossPrice+0.5%*GrossPrice', [pct(9.5), pct(0.5)]),
]);

const BY_ID = new Map(FEE_SCHEMES.map((s) => [s.id, s]));

export const getFeeScheme = (id) => BY_ID.get(id);
export const feeSchemeIds = () => FEE_SCHEMES.map((s) => s.id);
