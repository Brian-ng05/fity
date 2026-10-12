> Bản cập nhật mới nhất: đọc UPPER_BODY_HANDOFF.md. Webcam thân trên là mặc định; /scan dùng màn hình kết quả mới, không còn giao diện kỹ thuật cũ.

# Storefront integration handoff — 12/10/2026

## What changed

`/` is now a Vietnamese MORPH Studio illustrative product detail page. `/scan` retains the earlier technical scan UI. The user selected a shopping demo with product and embedded size-finder, expanding the earlier scan-only scope.

New shopper workflow: open product → choose size manually or open fit module → two-angle capture → actual backend reconstruction → product-specific size advice → apply chosen size to product → local demo cart. Product, chart and price are deliberately illustrative. Checkout, payment, order creation and external ecommerce connectors are not implemented.

## File map

- `frontend/components/shop/Storefront.tsx`: product, size selection, chart dialog, favorite toggle, cart.
- `frontend/components/shop/Modal.tsx`: native dialog, focus return, body scroll locking.
- `frontend/components/shop/FitExperience.tsx`: photos, consent, guidance camera, processing, result, size callback, error/retry, delete/export.
- `frontend/lib/useBodyScan.ts`: existing backend scan lifecycle extracted from the old page.
- `frontend/lib/catalog.ts`: one illustrative product and BODY chart; replace with merchant-owned data.
- `frontend/components/BodyViewer.tsx`: optional studio material, unchanged geometry/contours; render-on-demand when not auto-rotating.
- `frontend/app/commerce.css`: scoped storefront/modal design. Existing scan/camera styles remain for `/scan`.

## Integration seam

Mount `FitExperience` with `{product, active, onSelectSize}`. The callback updates the host product's size selection; it does not place an order. Catalog rows must use cm body ranges, not laid-flat garment dimensions. Backend size matching is unchanged and can return zero, one or multiple candidates. Reopening the dialog retains the current in-memory session; a page reload clears scan UI. No body photos or measurements are added to localStorage.

To integrate a real store next, map verified merchant products/variants and validated size charts to the product contract, connect its real cart adapter, then add authentication/tenant controls before public hosting. Do not present the demo chart or synthetic test results as commercial sizing validation.

## Run

Use the same `start-backend.ps1` and `start-frontend.ps1` on D. Main URL http://127.0.0.1:3000; technical route http://127.0.0.1:3000/scan. Restart frontend/backend if an old server is running.

## Verification

Production Next Webpack build includes `/`, `/scan`, `/icon.svg`. Browser harness `verification/scripts/commerce-ui.cjs` uses isolated production3107/backend8007 and rendered mannequin camera fixtures. Evidence is saved under `output/playwright/commerce-20261012`. Consult its results.json for actual pass/fail, not this architectural description. Human measurement accuracy and hardware camera behavior remain unvalidated.

Verified 2026-10-12: production build and TypeScript passed; browser workflow passed with no page/console errors. Checks covered chart, manual selection, cart persistence/quantity/removal, empty camera rejection, two-angle guided auto-capture, real backend reconstruction, size callback into the product, rotation preset synchronization, session deletion, camera track cleanup, mobile overflow and `/scan`. Backend regression suite: 27 passed in 5.11s; one pre-existing Starlette/httpx deprecation warning. Final cart screenshot was recaptured after the dialog entrance animation settled (`commerce-cart-capture.cjs`). These are synthetic fixture checks, not human accuracy validation.

Design and generated-image prompts are recorded in `DESIGN.md` and `design/ASSET_PROVENANCE.md`.
