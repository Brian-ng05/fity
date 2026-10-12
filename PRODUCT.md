# MORPH AI
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js frontend and Python backend in separate source folders, per the ongoing implementation brief. Java is not required. Runtime dependencies are installed locally to the project.

## Users
Vietnamese fashion SMEs and startup founders evaluating a body reconstruction demo, and people trying their own full-body photos.

## Product Purpose
Upload or capture body photos and inspect an actual reconstructed 3D surface in a browser. The immediate deliverable is a local working demo, not a commercial SaaS.

## Capabilities and Constraints
No e-commerce integration, payments, or accounts in this demo. Do not represent sample avatars or unvalidated measurements as a successful scan. User has selected design-image-first implementation. Hardware detected: NVIDIA MX330, 2 GB VRAM. Current implementation uses local CPU MediaPipe plus a MakeHuman template. User selected continuous pose guidance, two-angle capture and clothing size advice. Measurement accuracy remains unvalidated; external SAM/GPU is not part of this iteration.

## Brand Commitments
MORPH AI, Vietnamese copy. User accepted a proposed light, compact scan interface and requested a design image before frontend implementation.

## Evidence on Hand
User product brief and reference products 3DLOOK and SnapMeasureAI. No real customer body images or accuracy validation supplied.

## Product Principles
Make the real scan path obvious. Explain limitations at the point of use. Keep the demo runnable with reproducible setup scripts. Never show fabricated accuracy or scan results.
