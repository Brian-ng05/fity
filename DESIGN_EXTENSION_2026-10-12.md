# MORPH AI — design extension, 12 October 2026

This ordinary extension documents the wider camera and body-fit avatar within the existing bright Vietnamese interface. It preserves the established design-system files and does not migrate tokens or repair unrelated drift.

Baseline: `C:/Users/Phan Trinh Tien Dat/Documents/Codex/2026-10-09/https-3dlook-ai-content-hub-https/outputs/morph-ai-handoff/DESIGN.md`. Source review: `frontend/components/GuidedCamera.tsx`, `frontend/components/BodyViewer.tsx`, `frontend/app/scan-review.css`, and `PRODUCT.md`. These findings are from source inspection, not a new browser or physical-camera test.

## Preserved design direction

- Retain Vietnamese task copy, the warm light surfaces, forest action color, sage surroundings, and existing Be Vietnam Pro typography.
- New controls reuse the existing surface, ink, muted, line, green, and sage CSS variables. Keep thin borders and compact rounded controls; the body remains the principal source of visual depth.
- Preserve explicit sample/result distinctions and limitations near the relevant action. This remains a local CPU MediaPipe and MakeHuman-template demo, not a validated measuring service.

## Camera extension

`GuidedCamera.tsx` requests ideal 1920 × 1080 video with `resizeMode: none` and no forced aspect-ratio constraint. It derives preview ratio from the actual video dimensions. Capture uses the video's full native width and height. `scan-review.css` uses `object-fit: contain` rather than cropping the video to a portrait frame.

- Preserve the camera's native frame and keep head, hands, and feet within the visible guidance frame. Wider presentation must not imply a wider physical lens.
- Show camera selection using available devices. Expose hardware zoom only when the active track reports a usable zoom range; apply its minimum for the widest supported view. If unsupported or unsuccessful, explain moving farther away instead of inventing zoom capability.
- The dialog is `min(1120px, 96vw)` with a flexible preview and a 280px options column, separated by 24px. At 760px and below, stack the columns with an 18px gap. Preview height is capped at 58dvh, or 50dvh on mobile. Preserve responsive access to the options and capture action.
- Camera close controls have a 44px minimum target. Feedback uses status semantics; the countdown is announced politely; camera failures expose retry and upload alternatives.
- AI guidance is optional and its frame-upload disclosure stays beside the toggle. Automatic capture waits for repeated ready/stable checks. Describe this as periodic frame guidance, not continuous measurement. Manual capture retains its three-second countdown.

## Avatar extension

`BodyViewer.tsx` renders section lines from supplied `Section.points_m` coordinates, scaled consistently with the displayed 1.75-unit body. It preserves result origin and uses the same vertical offset for the result and section geometry. The reviewed frontend consumes actual supplied model-contour points; it does not construct decorative circumference ellipses. Backend contour extraction and human accuracy are outside this source review.

- Keep contour lines attached to the model in all views and use their corresponding labels: forest chest (`#17694c`), warm brown waist (`#995423`), and blue hip (`#365b88`). These are local data encodings, not a replacement brand palette.
- The legend is ordinary DOM outside `Canvas`, with readable labels, tabular values, and `cm` units. It displays `model_cm`, the avatar's own contour value; it must not imply independently verified body measurements.
- Keep “Trước”, “Nghiêng”, “Sau”, and “3/4” as named camera presets. Selecting a preset pauses automatic rotation so the chosen view can be inspected. Presets use a paper surface, compact corners, and sage hover; minimum heights are 38px desktop and 40px mobile.
- Show contour geometry only when result data, the contour toggle, section points, and target height are available. Preserve the sample/result distinction and avoid suggesting sample contours are a personal scan.
- Soft contact shadows ground the body inside the 3D scene. They do not authorize heavy shadows on surrounding form panels.

## Baseline drift observed; left unchanged

These differences already exist in the reviewed implementation relative to the saved baseline. Their introduction date was not established by this review.

- The baseline model token is `#96ab94`, roughness 0.68, metalness 0.08. The current viewer uses `#a5b5a3`, roughness 0.82, metalness 0.02, hemisphere lighting, and contact shadows. This is a more matte body rendering; no global token refresh was performed.
- The baseline does not describe guided camera selection/zoom, section contours, the DOM legend, or four angle presets. The rules above document these local extensions without replacing its overall layout or typography guidance.
- `scan-review.css` also contains existing measurement summaries and clothing-size table styles beyond this camera/avatar scope. They continue using the established variables; this document does not expand or redesign those flows.
- `PRODUCT.md` now records local CPU MediaPipe, a MakeHuman template, pose guidance, and clothing-size advice. Its statement that accuracy is unvalidated remains authoritative; guidance UI must not be described as continuous validated measurement.

## Evidence limits

The reported QA for this iteration is synthetic only. Synthetic contour-fit checks can support consistency between a generated model and its targets; they do not validate measurements on real people, tailoring accuracy, real-face reconstruction, or a device's lens coverage. No accuracy claim is added by this extension. No browser inspection was requested for this documentation pass.
