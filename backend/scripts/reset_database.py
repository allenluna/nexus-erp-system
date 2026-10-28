import shutil
from pathlib import Path
d = Path(__file__).resolve().parent.parent / "data"
shutil.copy(d / "seed.json", d / "db.json"); print("db.json reset from seed.json")
