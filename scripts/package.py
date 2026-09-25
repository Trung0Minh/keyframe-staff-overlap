from pathlib import Path
import json
from zipfile import ZipFile, ZIP_DEFLATED

version = json.loads(Path("manifest.json").read_text())["version"]
output = Path(f"artifacts/keyframe-staff-overlap-{version}.zip")
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for path in sorted(Path("dist").rglob("*")):
        if path.is_file():
            archive.write(path, path.relative_to("dist"))
with ZipFile(output) as archive:
    assert archive.testzip() is None
print(f"Packaged and verified {output}")
