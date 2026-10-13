import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Overridable so a second instance (QA harness, a parallel demo) does not sweep the other
# instance's model files: cleanup() deliberately deletes any GLB that has no matching
# in-memory session, which is right for a restart but destructive across two live servers.
DATA = Path(os.getenv("MORPH_DATA_DIR", ROOT / "data"))
MODELS = ROOT / "models"
MAX_UPLOAD = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
RESULT_TTL_SECONDS = 3600
