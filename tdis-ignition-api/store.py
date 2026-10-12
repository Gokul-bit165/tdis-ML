"""Tiny storage abstraction: a local folder, or Azure Blob via `az://<account>/<container>/<prefix>`."""
from __future__ import annotations

import io
import json
import os
from pathlib import Path

import pandas as pd


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

    def list(self, suffix: str = "") -> list[str]:
        if self._local is not None:
            return sorted(p.name for p in self._local.iterdir() if p.name.endswith(suffix))
        cut = len(self._prefix) + 1 if self._prefix else 0
        names = (b.name[cut:] for b in self._container.list_blobs(name_starts_with=self._key("")))
        return sorted(n for n in names if "/" not in n and n.endswith(suffix))

    def list_info(self, suffixes: tuple = ()) -> list[tuple[str, str]]:
        """(name, last_modified ISO) for files directly in this folder, oldest upload first."""
        from datetime import datetime, timezone
        if self._local is not None:
            rows = [(p.name, datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat(timespec="seconds"))
                    for p in self._local.iterdir() if p.is_file() and p.name.lower().endswith(suffixes)]
        else:
            cut = len(self._prefix) + 1 if self._prefix else 0
            rows = [(b.name[cut:], b.last_modified.astimezone(timezone.utc).isoformat(timespec="seconds"))
                    for b in self._container.list_blobs(name_starts_with=self._key(""))
                    if "/" not in b.name[cut:] and b.name.lower().endswith(suffixes)]
        return sorted(rows, key=lambda r: r[1])

    def read_bytes(self, name: str) -> bytes:
        if self._local is not None:
            return (self._local / name).read_bytes()
        return self._container.download_blob(self._key(name)).readall()

    def write_bytes(self, name: str, data: bytes) -> None:
        if self._local is not None:
            (self._local / name).write_bytes(data)
        else:
            self._container.upload_blob(self._key(name), data, overwrite=True)

    def exists(self, name: str) -> bool:
        if self._local is not None:
            return (self._local / name).exists()
        return self._container.get_blob_client(self._key(name)).exists()

    def read_parquet(self, name: str) -> pd.DataFrame:
        return pd.read_parquet(io.BytesIO(self.read_bytes(name)))

    def write_parquet(self, name: str, df: pd.DataFrame) -> None:
        buf = io.BytesIO()
        df.to_parquet(buf, index=False)
        self.write_bytes(name, buf.getvalue())

    def read_json(self, name: str) -> dict:
        return json.loads(self.read_bytes(name))

    def write_json(self, name: str, obj: dict) -> None:
        self.write_bytes(name, json.dumps(obj, indent=2).encode())


def store_from_env(var: str) -> Store | None:
    uri = os.environ.get(var)
    return Store(uri) if uri else None

