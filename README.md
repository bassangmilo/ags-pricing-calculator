# AGS Pricing Calculator (web)

Static, client-side, no backend. Same logic as the Excel/VBA calculator.

## Run locally
    python3 -m http.server 8000     # then open http://localhost:8000
(ES modules and the service worker need http(s); double-clicking index.html will not work.)

## Use on your phone
Host the folder on any static HTTPS host (GitHub Pages, Netlify, Cloudflare Pages), open the URL on the phone,
then "Add to Home Screen" (iPhone: Share > Add to Home Screen; Android: menu > Install app).
It works offline after the first load.

## Change or add a fee scheme
Edit ONLY src/fees/feeSchemes.js (one line per scheme), run `npm test`, redeploy.
The `formula` string on each line is documentation and is cross-checked by the tests; the `terms` array is what runs.
Updated fees appear on the SECOND open after deploying (stale-while-revalidate). To force it, bump CACHE in sw.js.

## Tests
    npm test        # Node 20+, no dependencies

## Layout
src/fees (fee table + engine) · src/calculator (solvers + cell-by-cell Excel port) ·
src/formatting · src/validation · src/ui
`sellingPrice*` solvers keep the VBA's exact bisection; the upper bound is only widened when the VBA's bound
cannot contain the answer (pass { strictExcelBounds: true } to reproduce raw VBA behaviour).
