"""Text embeddings — production uses OpenAI text-embedding-3-large.

In dev/no-key mode we use a deterministic hash-based embedding so memory
can be tested offline without external calls.
"""
from __future__ import annotations

import hashlib
from typing import cast

from openai import AsyncOpenAI

from axion.config import get_settings

EMBED_DIM = 1536
_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI | None:
    global _client
    settings = get_settings()
    key = settings.openai_api_key.get_secret_value()
    if not key:
        return None
    if _client is None:
        _client = AsyncOpenAI(api_key=key)
    return _client


def _hash_embed(text: str, dim: int = EMBED_DIM) -> list[float]:
    """Deterministic, reproducible offline embedding via SHA chaining."""
    out = bytearray()
    seed = text.encode()
    while len(out) < dim * 4:
        seed = hashlib.sha256(seed).digest()
        out.extend(seed)
    floats = []
    for i in range(dim):
        b = out[i * 4 : (i + 1) * 4]
        v = int.from_bytes(b, "big", signed=False) / 2**32  # 0..1
        floats.append(v * 2 - 1)  # -1..1
    return floats


async def embed_text(text: str) -> list[float]:
    client = _get_client()
    if client is None:
        return _hash_embed(text)
    try:
        resp = await client.embeddings.create(
            input=text[:8000],
            model="text-embedding-3-large",
            dimensions=EMBED_DIM,
        )
        return cast(list[float], resp.data[0].embedding)
    except Exception:
        return _hash_embed(text)


async def embed_batch(texts: list[str]) -> list[list[float]]:
    client = _get_client()
    if client is None:
        return [_hash_embed(t) for t in texts]
    try:
        resp = await client.embeddings.create(
            input=[t[:8000] for t in texts],
            model="text-embedding-3-large",
            dimensions=EMBED_DIM,
        )
        return [cast(list[float], item.embedding) for item in resp.data]
    except Exception:
        return [_hash_embed(t) for t in texts]
