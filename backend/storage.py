import mimetypes
import os
from pathlib import Path

STORAGE_ROOT = Path(os.environ.get("LOCAL_STORAGE_DIR") or Path(__file__).parent / "uploads")


def init_storage(force: bool = False) -> str:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_ROOT)


def put_object(path: str, data: bytes, content_type: str) -> dict:
    init_storage()
    file_path = STORAGE_ROOT / path
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_bytes(data)
    return {"path": path}


def get_object(path: str) -> tuple:
    init_storage()
    file_path = STORAGE_ROOT / path
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return file_path.read_bytes(), content_type
