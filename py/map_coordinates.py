"""Generate UMAP or PaCMAP coordinates directly from stored embeddings."""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import asyncpg
import numpy as np
from dotenv import load_dotenv


async def embeddings(limit, cache):
    if cache.exists():
        with np.load(cache) as saved:
            return saved["appids"], saved["vectors"]
    load_dotenv(".env")
    connection = await asyncpg.connect(os.environ["DATABASE_URL"], timeout=15)
    try:
        async with connection.transaction(isolation="repeatable_read", readonly=True):
            count = await connection.fetchval(
                "SELECT count(*) FROM (SELECT appid FROM steam_game_embeddings_06b LIMIT $1) g",
                limit or None,
            )
            appids = np.empty(count, dtype=np.int64)
            vectors = None
            index = 0
            query = (
                "SELECT appid, embedding::real[] AS embedding FROM steam_game_embeddings_06b "
                "ORDER BY appid, appid LIMIT $1"
            )
            async for row in connection.cursor(query, limit or None, prefetch=256):
                if vectors is None:
                    vectors = np.empty((count, len(row["embedding"])), dtype=np.float32)
                appids[index] = row["appid"]
                vectors[index] = row["embedding"]
                index += 1
                if index % 10000 == 0:
                    print(
                        f"Loaded {index:,}/{count:,} embeddings",
                        file=sys.stderr,
                        flush=True,
                    )
            if vectors is None:
                raise ValueError("No stored embeddings")
    finally:
        await connection.close()
    cache.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, appids=appids, vectors=vectors)
    return appids, vectors


def project(vectors, method, dimensions):
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import normalize

    if (
        len(vectors) < 3
        or not np.isfinite(vectors).all()
        or np.any(np.linalg.norm(vectors, axis=1) == 0)
    ):
        raise ValueError("Need at least three finite, nonzero embeddings")
    components = min(50, vectors.shape[1], len(vectors) - 1)
    reduced = normalize(
        PCA(
            n_components=components, svd_solver="randomized", random_state=42
        ).fit_transform(vectors)
    )
    neighbours = min(30, len(vectors) - 1)
    if method == "umap":
        import umap

        reducer = umap.UMAP(
            n_components=dimensions,
            metric="cosine",
            n_neighbors=neighbours,
            min_dist=0.1,
            random_state=42,
            n_jobs=1,
        )
    else:
        import pacmap

        reducer = pacmap.PaCMAP(
            n_components=dimensions,
            n_neighbors=neighbours,
            apply_pca=False,
            random_state=42,
        )
    points = np.asarray(reducer.fit_transform(reduced), dtype=float)
    if not np.isfinite(points).all():
        raise ValueError("Projection produced nonfinite coordinates")
    lower, upper = points.min(axis=0), points.max(axis=0)
    return (points - (lower + upper) / 2) / max(
        float((upper - lower).max()), 1e-12
    ) + 0.5


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--method", choices=["umap", "pacmap"], default="umap")
    parser.add_argument("--limit", type=int, default=0, help="0 means all stored games")
    parser.add_argument("--dimensions", type=int, choices=[2, 3], default=3)
    parser.add_argument("--output", type=Path, required=True, help="Output JSON array")
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("Limit must be nonnegative")
    cache_label = (
        "all"
        if not args.limit
        else f"{args.limit // 1000}k"
        if args.limit % 1000 == 0
        else str(args.limit)
    )
    appids, vectors = asyncio.run(
        embeddings(args.limit, Path(f"data/layout-sample-{cache_label}.npz"))
    )
    print(
        f"Projecting {len(appids):,} embeddings with {args.method}…",
        file=sys.stderr,
        flush=True,
    )
    started = time.monotonic()
    points = project(vectors, args.method, args.dimensions)
    keys = ("x", "y", "z")[: args.dimensions]
    records = [
        dict(
            appid=int(appid), **{axis: float(value) for axis, value in zip(keys, point)}
        )
        for appid, point in zip(appids, points)
    ]
    temporary = args.output.with_name(args.output.name + ".tmp")
    temporary.write_text(json.dumps(records, separators=(",", ":")))
    temporary.replace(args.output)
    print(
        f"Wrote {len(records):,} coordinates to {args.output}; projection took {time.monotonic() - started:.1f}s",
        file=sys.stderr,
        flush=True,
    )


if __name__ == "__main__":
    main()
