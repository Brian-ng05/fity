# MORPH AI agent entry point

1. Work in `D:\MORPH-AI`. Read `AGENT_HANDOFF.md`, `README.md`, and `HUONG_DAN_CHAY.md` before changes.
2. Keep `frontend/` and `backend/` separate. Do not edit the older copy under Documents/Codex as the canonical source.
3. Immediate scope: local two-photo body-shape demo. No e-commerce integration, billing, Mix & Match, or public deployment unless requested.
4. The engine is MediaPipe segmentation/pose + MakeHuman template deformation. It is not SAM/MHR; face identity and validated body measurements are not implemented. Do not fake successful scan results or accuracy claims.
5. Preserve the Vietnamese bright, compact interface and reference image in `design/`. Read `frontend/AGENTS.md` before frontend changes.
6. Use project Python `backend/.venv/Scripts/python.exe`; do not use the Windows Store alias. Venv is not portable. Never commit runtime, node_modules, photos, generated private GLBs, or credentials.
7. Run relevant checks and record actual outcomes, limitations, and next steps in the handoff. Protect existing user edits. Avoid broad machine configuration changes.
