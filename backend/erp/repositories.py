"""Only module that touches the JSON file. Process-wide lock + atomic replace.
LIMIT: the lock does not coordinate multiple worker processes; run one worker."""
import json, os, shutil, tempfile, threading, uuid
from contextlib import contextmanager
from pathlib import Path
from django.conf import settings
from rest_framework.exceptions import APIException
_lock = threading.RLock()
class StorageError(APIException):
    status_code = 500
    default_detail = "Data store is unavailable or contains invalid JSON."
def _load():
    p = Path(settings.ERP_DB_PATH)
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(settings.ERP_SEED_PATH, p)
    try: return json.loads(p.read_text("utf-8"))
    except (json.JSONDecodeError, OSError): raise StorageError()
def _save(db):
    p = Path(settings.ERP_DB_PATH)
    fd, tmp = tempfile.mkstemp(dir=p.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, default=str); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, p)
@contextmanager
def transaction():
    """Load, mutate, save. If the body raises, nothing is written."""
    with _lock:
        db = _load()
        yield db
        _save(db)
def read():
    with _lock: return _load()
def get(col, id): return next((r for r in read()[col] if r["id"] == id), None)
def new_id(): return str(uuid.uuid4())
