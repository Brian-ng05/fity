# Scan surface contract

Updated 2026-10-12. Visual authority: user-provided SnapMeasureAI result screenshots. Reuse the shared fit module in the storefront dialog and standalone `/scan`.

## Capture and provenance

Default `upper_body` capture uses front and side photographs from head through waistband, plus entered height. Feet are unnecessary. `full_body` remains optional. Upper-body scale assumes a shoulder-to-hip template ratio of 0.29 of entered height; it is a prior, not a measured body ratio.

| Report row | Upper-body source | Full-body source |
| --- | --- | --- |
| Height | User input | User input |
| Chest, waist, shoulder width | Photos plus template scale | Photo estimate |
| Hip | Template model | Photo estimate |
| Head, neck, left thigh, left calf, left ankle circumference | Template model | Template model |
| Arm length, inside-leg length | Unavailable | Unavailable |

There are 12 report rows. A normal successful report has 10 values and two unavailable lengths; failed template cross-sections can produce additional unavailable entries. Template circles are closed sections on the actual mesh at assumed anatomical levels. Do not call them observed measurements. JSON exports preserve source identifiers (`user_input`, `photo_with_prior`, `photo_estimate`, `template_model`, `unavailable`). Display units can change to inches, while JSON values retain centimeters.

## Composition and state

Use a large dark 3D stage with teal model, colored contours, left measurement list, right tools, view presets below the subject, and a flat measurement grid below the stage. Solid, points, and wireframe are rendering modes of the estimated model. Keep the source note above the workspace visible. On mobile, tools wrap above the canvas and the measurement list follows the viewer.

The backend supplies values and model geometry. Preserve readable data and downloads when 3D rendering fails. Retain the size-recommendation retry and no-match states, recapture/delete behavior, consent, and session lifetime handling. Cart remains local demonstration behavior; no authentication, payment, or real-world accuracy validation is implemented.

## Evidence and assets

- Source: `frontend/components/shop/ScanResult.tsx`, `FitExperience.tsx`, `frontend/components/GuidedCamera.tsx`, `frontend/components/BodyViewer.tsx`, `frontend/app/scan-result.css`, `backend/app/reconstruction.py`, and `backend/app/report.py`.
- Actual result evidence: `output/playwright/upper-20261012/result-desktop.png`, `points-desktop.png`, `camera-upper.png`, and `result-mobile.png`. Mobile toolbar implementation changed during the final verification pass; verify the refreshed mobile image before treating it as final evidence.
- `design/commerce-reference.png` is the earlier generated storefront concept, not evidence of the current scan result. `frontend/public/products/essential-ivory.png` is the generated illustrative product asset.
- No new raster design reference was needed for the result workspace because the user supplied direct visual references. The model is interactive geometry, not a generated raster substitute.
