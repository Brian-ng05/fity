# MORPH AI
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js frontend and Python backend in separate source folders, per the ongoing implementation brief. Java is not required. Runtime dependencies are installed locally to the project.

## Users
Vietnamese fashion SMEs and startup founders evaluating a body reconstruction demo, including shoppers using laptop webcams to capture their upper body.

## Product Purpose
Latest capture flow: camera only, with no upload inputs or pre-scan mannequin. Height and consent → one camera session → pose-gated front countdown → automatic 90-degree turn prompt → side countdown → automatic reconstruction. See CAMERA_FLOW_HANDOFF.md; this supersedes earlier input layouts.
Demonstrate a Vietnamese fashion product page with an embedded size finder: capture two body views, inspect an estimated 3D body, receive product-specific size advice and apply the selection to a local demo cart. The user explicitly selected this shopping experience on 12 October 2026, then requested upper-body laptop capture and a SnapMeasureAI-inspired result workspace. /scan now runs that same module as a standalone page.

## Capabilities and Constraints
The storefront, product image, price and size chart are illustrative. No external ecommerce platform integration, checkout, payments, orders or accounts are implemented. Do not represent sample avatars or unvalidated measurements as a successful scan. User has selected design-image-first implementation. Hardware detected: NVIDIA MX330, 2 GB VRAM. Current implementation uses local CPU MediaPipe plus a MakeHuman template. User selected continuous pose guidance, two-angle capture and clothing size advice. Measurement accuracy remains unvalidated; external SAM/GPU is not part of this iteration. The viewer's bodysuit tint is an illustration, not a garment simulation.

## Brand Commitments
Default capture is head-to-waistband upper body plus entered height, without requiring feet. Full-body remains optional. Upper-body scale assumes a template shoulder-to-hip proportion. Keep observed estimates distinct from template dimensions; hip stays null in the sizing measurements for this mode. The result workspace has 12 rows, 10 values and two unavailable lengths, with provenance labels. It must not claim the proprietary accuracy or measurement count of the reference product.
MORPH AI technology within a MORPH Studio shopping demo, Vietnamese copy. Warm ivory storefront and input, forest green actions; dark teal result workspace following the user's screenshots. User requested a full interface refactor and supplied a direct result-screen reference.

## Evidence on Hand
User product brief and reference products 3DLOOK and SnapMeasureAI. No real customer body images or accuracy validation supplied.

## Product Principles
Make the real scan path obvious. Explain limitations at the point of use. Keep the demo runnable with reproducible setup scripts. Never show fabricated accuracy or scan results.
