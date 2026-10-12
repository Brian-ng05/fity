---
name: MORPH Studio
description: Warm fashion storefront with a focused dark 3D measurement workspace.
colors:
  paper: "#f8f7f3"
  surface: "#fffefa"
  ink: "#242b27"
  muted: "#62685f"
  forest: "#194e3d"
  forest-hover: "#113b2d"
  sage: "#e9eee5"
  line: "#dddfd6"
  white: "#ffffff"
  scan-background: "#0d151b"
  scan-stage: "#080f13"
  scan-panel: "#101a21"
  scan-control: "#121e25"
  scan-control-hover: "#1b3037"
  scan-selected: "#12312f"
  scan-ink: "#e4edf0"
  scan-muted: "#a4b7c1"
  scan-line: "#2b3d45"
  scan-accent: "#38d1c1"
  scan-selected-ink: "#7ff1e3"
  scan-data: "#141f27"
  capture-background: "#0d171d"
  capture-accent: "#26cbb6"
  capture-text: "#e9f0f2"
typography:
  display:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 46px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "29px"
    fontWeight: 500
    lineHeight: 1.28
    letterSpacing: "-0.025em"
  result-title:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  data:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "21px"
    fontWeight: 600
rounded:
  size: "4px"
  action: "5px"
  upload: "7px"
  scan-control: "8px"
  scan-list: "10px"
  workspace: "14px"
spacing:
  tight: "8px"
  label: "12px"
  field: "16px"
  control: "20px"
  section: "24px"
  result: "26px"
  form: "30px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.white}"
    rounded: "{rounded.action}"
    padding: "14px 20px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.forest-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "14px 20px"
  result-control:
    backgroundColor: "{colors.scan-control}"
    textColor: "{colors.scan-ink}"
    rounded: "{rounded.scan-control}"
    padding: "10px 14px"
  result-control-selected:
    backgroundColor: "{colors.scan-selected}"
    textColor: "{colors.scan-selected-ink}"
  height-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.action}"
    padding: "8px 12px"
    width: "100px"
  result-list:
    backgroundColor: "{colors.scan-panel}"
    textColor: "{colors.scan-ink}"
    rounded: "{rounded.scan-list}"
---

# Design System: MORPH Studio

## Overview

**Creative North Star: "The Fitting Studio"**

MORPH Studio pairs a restrained, warm fashion storefront with a dark workspace for inspecting an estimated body model. The storefront uses generous product imagery and quiet forest actions. The result workspace uses a large teal 3D subject, explicit measurement sources, and compact controls; its visual authority is the user's supplied SnapMeasureAI screenshots.

These are complementary surfaces in one Vietnamese-language experience. The same fit module appears in the storefront dialog and on `/scan`; `/scan` is no longer a separate legacy diagnostics interface. Preserve the product context when opening, closing, or applying a size from the dialog.

**Key Characteristics:**

- Warm product photography and ivory shopping surfaces.
- Dark, spacious 3D inspection with teal emphasis.
- One self-hosted type family and restrained corner treatments.
- Measurement provenance visible beside every value.

## Colors

### Primary

Forest is the shopping action color; its deeper hover shade is reserved for actionable states. Teal is the result-workspace accent, used for selected controls, model presentation, and active units. Keep these roles tied to their respective surfaces.

### Neutral

Paper and surface form the warm storefront canvas. Ink, muted, and line support its text and boundaries. The result workspace uses scan-background outside the darker scan-stage, scan-panel for the measurement list, scan-data for the flat data grid, and scan-line for fine dividers. Scan-ink and scan-muted carry primary and supporting text.

**The Source Visibility Rule.** A measurement's source remains readable alongside its value; color alone never communicates whether a value came from photos, entered height, or the template.

## Typography

Be Vietnam Pro is self-hosted in weights 400, 500, 600, and 700. Use the same family for commerce, capture, and results. Product titles use the display role; capture headings use headline; result headings use result-title. Numeric data is stronger and larger than its label.

The result list uses compact labels and source annotations, while the data grid below repeats values at the larger data scale. Supporting text ranges from 10–13px in the current implementation. Do not make critical capture directions dependent on tiny annotations alone. Preserve Vietnamese diacritics in labels and font rendering.

## Layout

The storefront has a maximum width of 1440px, desktop gutters of 5%, and a product grid of 1.18:1 with a 7% gap. At 760px it becomes a single column with 6% gutters. Scan preparation uses a centered 900px column with a three-step explanation, height and framing fields, consent, and one camera action. Its dialog is at most 960px; the active camera dialog expands to 1080px. There is no sample mannequin or upload column. On mobile, the steps and fields stack vertically.

The result dialog expands to 1380px and 96vw; standalone scan content has a 1500px maximum. On desktop, the workspace has a 265px measurement column and a flexible 650px-tall 3D stage. The list sits to the left of the model and tools sit on the right. Below it, the size action precedes a flat four-column measurement grid. At 900px the list becomes 220px and the data grid has three columns. At 650px the stage appears first, tools wrap into rows above the canvas, the measurement list follows, and the data grid has two columns. The mobile canvas is 490px tall in the current implementation.

Camera preview follows the device's intrinsic aspect ratio with contained video, a thin frame marker, centered countdown and bottom instructions. Upper-body mode requires head through waistband and entered height, making laptop capture possible without feet. Keep full-body framing as an explicit camera alternative. Capture instructions must match the selected mode.

## Elevation & Depth

The storefront is predominantly flat: imagery, whitespace, and fine borders establish hierarchy. Dialogs use a translucent backdrop rather than heavy shadows. The result workspace uses nested tonal planes only where function requires them: one measurement panel beside the stage, and a flat data grid below. The ground grid and lit interactive mesh provide depth within the 3D scene.

Keep animation functional. Auto-rotation is optional and initially off. View presets and reset controls help recover orientation. CSS honors the existing reduced-motion preference.

## Shapes

Controls have restrained corners, with size selectors tighter than large workspace boundaries. The product photograph remains an unrounded editorial rectangle. Result controls, the measurement panel, and the workspace use their distinct radii from the frontmatter. Circular swatches and small source dots are functional accents. Avoid turning every text group into a card.

## Components

### Shopping actions and navigation

The primary action is a full-width forest button with a 52px minimum height. The secondary action is transparent with a fine border. Size controls have a 48px minimum height and selected forest fill. Shopping focus uses a 2px forest outline with 4px offset. Header navigation disappears at the mobile breakpoint while logo and bag remain available.

### Capture fields and camera

Camera is the only input path. Height remains visibly labeled with centimeters; upper-body framing is the default. Consent precedes camera activation and covers posture frames and the final pair. One stream handles both views: start, stable-pose check, five-second front countdown, four-second turn instruction, stable side-pose check, five-second side countdown, then automatic reconstruction. Cancel closes the stream and discards the partial pair. Camera selection is available before starting. No file inputs, manual single-frame capture, or sample mannequin appear before scanning. Preview imagery retains the full camera frame rather than cropping it into a portrait mask.

### Result workspace

Render a real interactive model with solid, point, and wireframe modes. Keep left measurement list, right tool stack, four view presets, and the lower data grid identifiable. The tools include optional rotation, reset, measurement rings, mode switch, GLB download, and image export. Header actions include JSON download, recapture, and fullscreen. Result focus uses a bright teal outline with 3px offset. Selected controls use a teal border, dark green fill, and bright mint text.

Measurement rows retain their source labels and cm/in selector. Clicking an annotated row highlights its corresponding contour; rows without geometry cannot select a contour. Missing measurements use an em dash plus an explicit unavailable label, never a fabricated zero. The report currently provides 12 rows: 10 values when all mesh sections succeed and two unavailable length measurements. The exact source contract lives in `.impeccable/surfaces/scan.md`.

The recommendation action applies a candidate size to the illustrative Essential T-shirt. Keep no-match and retry messages in the same region. The model is an estimate, not a scanned identity or simulated garment. Display the interactive model only after processing succeeds, in the dark teal inspection presentation.

## Do's and Don'ts

### Do:

- **Do** preserve the warm storefront while using the dark visual system for completed scan results.
- **Do** keep entered height, photo-based estimates, model-only dimensions, and unavailable values distinguishable.
- **Do** retain full camera framing and mode-specific head-to-waistband guidance.
- **Do** reflow the controls and measurement list around the mobile model instead of shrinking the desktop workspace.
- **Do** keep loading, offline, error, no-match, overlapping-size, deletion, and empty-cart states visible.

### Don't:

- **Don't** claim the unseen legs or template circles were observed by the webcam.
- **Don't** imply validated real-person accuracy, face reconstruction, garment simulation, authentication, payment, or order submission.
- **Don't** fill missing arm or inside-leg lengths with invented numbers.
- **Don't** present the earlier generated storefront concept as a screenshot of the running app.
- **Don't** reintroduce upload inputs or a sample mannequin into scan preparation; the user explicitly requested camera-only capture.
