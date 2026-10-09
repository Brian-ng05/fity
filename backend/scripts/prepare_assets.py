"""Keep only the body of the CC0 MakeHuman asset in the frontend preview."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "backend/models/body-template.obj"
target = root / "frontend/public/sample-body.obj"
target.parent.mkdir(exist_ok=True, parents=True)
keep = []
active = True
for line in source.read_text(encoding="utf-8").splitlines():
    if line.startswith("g "):
        active = line.strip() == "g body"
    if line.startswith(("v ", "vt ", "vn ", "#")) or (active and line.startswith(("f ", "g "))):
        keep.append(line)
target.write_text("\n".join(keep), encoding="utf-8")
print(f"Preview ready: {target.name}")
