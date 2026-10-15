"""Tiny storage abstraction: a local folder, or Azure Blob via `az://<account>/<container>/<prefix>`.
Names are paths relative to the root, with forward slashes (for example `assessments/run1/manifest.json`)."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path


class Store:
    def __init__(self, uri: str):
        self.uri = uri.rstrip("/")
        if uri.startswith("az://"):
            account, container, *prefix = uri[len("az://"):].split("/", 2)
            from azure.identity import DefaultAzureCredential  # lazy: only needed for Azure
            from azure.storage.blob import BlobServiceClient

            self._container = BlobServiceClient(
                f"https://{account}.blob.core.windows.net", credential=DefaultAzureCredential()
            ).get_container_client(container)
            self._prefix = (prefix[0] if prefix else "").strip("/")
            self._local = None
        else:
            self._local = Path(uri)
            self._local.mkdir(parents=True, exist_ok=True)

    def _key(self, name: str) -> str:
        return f"{self._prefix}/{name}" if self._prefix else name

    def list_info(self, folder: str, suffixes: tuple) -> list[tuple[str, str]]:
        """(name, last_modified ISO) for every file under `folder`, at any depth, oldest upload first."""
        folder = folder.strip("/")
        if self._local is not None:
            base = self._local / folder
            rows = [(p.relative_to(self._local).as_posix(),
                     datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"))
                    for p in (base.rglob("*") if base.exists() else []) if p.is_file() and p.name.lower().endswith(suffixes)]
        else:
            cut = len(self._prefix) + 1 if self._prefix else 0
            rows = [(b.name[cut:], b.last_modified.astimezone(timezone.utc).isoformat(timespec="seconds"))
                    for b in self._container.list_blobs(name_starts_with=self._key(folder + "/"))
                    if b.name.lower().endswith(suffixes)]
        return sorted(rows, key=lambda r: (r[1], r[0]))

    def exists(self, name: str) -> bool:
        if self._local is not None:
            return (self._local / name).exists()
        return self._container.get_blob_client(self._key(name)).exists()

    def read_bytes(self, name: str) -> bytes:
        if self._local is not None:
            return (self._local / name).read_bytes()
        return self._container.download_blob(self._key(name)).readall()
