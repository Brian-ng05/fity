# MORPH AI
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js frontend and Python backend in separate source folders, per the ongoing implementation brief. Java is not required. Runtime dependencies are installed locally to the project.

## Users
Vietnamese fashion SMEs and startup founders evaluating a body reconstruction demo, and people trying their own full-body photos.

## Product Purpose
Demonstrate a Vietnamese fashion product page with an embedded size finder: capture two body views, inspect an estimated 3D body, receive product-specific size advice and apply the selection to a local demo cart. The user explicitly selected this shopping experience on 12 October 2026. The technical scan tool remains at /scan.

## Capabilities and Constraints
The storefront, product image, price and size chart are illustrative. No external ecommerce platform integration, checkout, payments, orders or accounts are implemented. Do not represent sample avatars or unvalidated measurements as a successful scan. User has selected design-image-first implementation. Hardware detected: NVIDIA MX330, 2 GB VRAM. Current implementation uses local CPU MediaPipe plus a MakeHuman template. User selected continuous pose guidance, two-angle capture and clothing size advice. Measurement accuracy remains unvalidated; external SAM/GPU is not part of this iteration. The viewer's bodysuit tint is an illustration, not a garment simulation.

## Brand Commitments
MORPH AI technology within a MORPH Studio shopping demo, Vietnamese copy. Warm ivory surfaces, forest green actions and an editorial product layout. User requested a full interface refactor and a design image before implementation.

## Evidence on Hand
User product brief and reference products 3DLOOK and SnapMeasureAI. No real customer body images or accuracy validation supplied.

## Product Principles
Make the real scan path obvious. Explain limitations at the point of use. Keep the demo runnable with reproducible setup scripts. Never show fabricated accuracy or scan results.
