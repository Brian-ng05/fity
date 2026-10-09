# Third-party components

- MakeHuman base mesh, body geometry only: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj . Asset explicitly CC0; its original notices remain in the OBJ. Project source code is AGPL, but this demo does not copy that source code. https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- MediaPipe: https://github.com/google-ai-edge/mediapipe (Apache-2.0). Pose Landmarker model distributed by Google: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker . Model URL/version is recorded in setup.ps1. Retain and review the corresponding model card and distribution terms before commercial use.
- Next.js, React, Three.js, React Three Fiber, Drei, FastAPI and Trimesh are third-party libraries; retain package notices when redistributing.
- Be Vietnam Pro is self-hosted via @fontsource/be-vietnam-pro; its font package contains the OFL license.
- Interface design reference was generated using the built-in imagegen tool. The image is design documentation, not a screenshot or a claim of scan output.

This demo does not bundle or execute SAM 3D Body, MHR, SMPL, or PIFuHD. It does not claim their reconstruction quality.
