import argparse
import asyncio
import html
import json
import os
import re
import sys
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


def read_games(path, limit, start_from=None):
    # Decode one at a time
    decoder = json.JSONDecoder()
    with path.open() as source:
        buffer = source.read(65536).lstrip()
        if not buffer.startswith("{"):
            raise ValueError("Expected a JSON object keyed by app ID")
        buffer = buffer[1:]
        count = 0
        started = start_from is None
        while limit is None or count < limit:
            buffer = buffer.lstrip(" \r\n\t,")
            if buffer.startswith("}"):
                if not started:
                    raise ValueError(f"App ID {start_from} not found in catalogue")
                return
            try:
                appid, end = decoder.raw_decode(buffer)
                rest = buffer[end:].lstrip()
                if not rest.startswith(":"):
                    raise ValueError("Missing value separator ( : ) ")
                rest = rest[1:].lstrip()
                game, end = decoder.raw_decode(rest)
            except ValueError:
                chunk = source.read(65536)
                if not chunk:
                    raise ValueError("Incomplete or invalid catalogue JSON")
                buffer += chunk
                continue
            buffer = rest[end:]
            if not started:
                started = str(appid) == str(start_from)
                if not started:
                    continue
            count += 1
            yield appid, game


def game_text(game):
    def clean(value):
        return " ".join(html.unescape(re.sub(r"<[^>]*>", " ", value or "")).split())

    tags = game.get("tags", [])
    if isinstance(tags, dict):
        tags = sorted(tags, key=tags.get, reverse=True)
    fields = [
        ("Title", game.get("name", "")),
        ("Genres", ", ".join(game.get("genres", []))),
        ("Tags", ", ".join(tags)),
        ("Features", ", ".join(game.get("categories", []))),
        ("Summary", game.get("short_description", "")),
        (
            "Description",
            game.get("about_the_game") or game.get("detailed_description", ""),
        ),
    ]
    return "\n".join(f"{label}: {clean(value)}" for label, value in fields if value)


async def coordinates(limit):
    import networkx as nx

    connection = await asyncpg.connect(os.environ["DATABASE_URL"], timeout=15)
    try:
        print("Preparing cosine search index…", file=sys.stderr, flush=True)
        await connection.execute("""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS steam_games_06b_cosine_idx
            ON steam_game_embeddings_06b USING hnsw (embedding vector_cosine_ops)
        """)
        async with connection.transaction(readonly=True):
            rows = await connection.fetch(
                "SELECT appid FROM steam_game_embeddings_06b ORDER BY appid LIMIT $1",
                limit or None,
            )
            appids = [row["appid"] for row in rows]
            print(
                f"Finding neighbours for {len(appids)} games…",
                file=sys.stderr,
                flush=True,
            )
            edges = await connection.fetch(
                """SELECT a.appid AS source, b.appid AS target, b.similarity
                FROM steam_game_embeddings_06b a
                CROSS JOIN LATERAL (
                    SELECT appid, 1 - (embedding <=> a.embedding) AS similarity
                    FROM steam_game_embeddings_06b
                    WHERE appid <> a.appid AND appid = ANY($1::bigint[])
                    ORDER BY embedding <=> a.embedding LIMIT 5
                ) b
                WHERE a.appid = ANY($1::bigint[])""",
                appids,
            )
    finally:
        await connection.close()

    graph = nx.Graph()
    graph.add_nodes_from(appids)
    for edge in edges:
        graph.add_edge(
            edge["source"], edge["target"], weight=max(0.001, edge["similarity"])
        )
    print("Laying out the 3D graph…", file=sys.stderr, flush=True)
    positions = nx.spring_layout(graph, seed=42, dim=3, iterations=30, threshold=0.005)
    if not positions:
        return
    lower = [min(point[axis] for point in positions.values()) for axis in range(3)]
    span = [
        max(point[axis] for point in positions.values()) - lower[axis]
        for axis in range(3)
    ]
    print("Writing coordinates…", file=sys.stderr, flush=True)
    for appid, (x, y, z) in positions.items():
        x = (x - lower[0]) / span[0] if span[0] else 0.5
        y = (y - lower[1]) / span[1] if span[1] else 0.5
        z = (z - lower[2]) / span[2] if span[2] else 0.5
        print(json.dumps({"appid": appid, "x": float(x), "y": float(y), "z": float(z)}))


async def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=3, help="Number of games; 0 means all"
    )
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--start-from", type=int, help="Resume at this app ID in catalogue order (inclusive)")
    parser.add_argument(
        "--coordinates",
        action="store_true",
        help="Print graph coordinates from stored embeddings",
    )
    args = parser.parse_args()
    if args.limit < 0 or args.batch_size < 1:
        parser.error("Positive batch size plz")

    if args.coordinates:
        await coordinates(args.limit)
        return

    database_url = os.environ["DATABASE_URL"]

    import torch
    from sentence_transformers import SentenceTransformer

    if not torch.version.hip or not torch.cuda.is_available():
        raise RuntimeError("ROCm PyTorch cooked dawg")

    model = SentenceTransformer(
        "Qwen/Qwen3-Embedding-0.6B",
        device="cuda",
        model_kwargs={"torch_dtype": torch.bfloat16, "attn_implementation": "sdpa"},
        processor_kwargs={"padding_side": "left"},
    )
    connection = await asyncpg.connect(database_url)
    batch = []

    async def emit(records):
        vectors = model.encode(
            [game_text(game) for _, game in records],
            batch_size=args.batch_size,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        await connection.executemany(
            """
            INSERT INTO steam_game_embeddings_06b (appid, name, embedding)
            VALUES ($1, $2, $3::vector(1024))
            ON CONFLICT (appid) DO UPDATE
            SET name = EXCLUDED.name, embedding = EXCLUDED.embedding
            """,
            [
                (int(appid), game.get("name", ""), json.dumps(vector.tolist()))
                for (appid, game), vector in zip(records, vectors)
            ],
        )
        for appid, game in records:
            print(f"Saved {appid}: {game.get('name', '')}", flush=True)

    try:
        await connection.execute("""
            CREATE EXTENSION IF NOT EXISTS vector;
            CREATE TABLE IF NOT EXISTS steam_game_embeddings_06b (
                appid bigint NOT NULL,
                name text NOT NULL,
                embedding vector(1024) NOT NULL,
                PRIMARY KEY (appid)
            );
        """)
        for record in read_games(Path("data/games.json"), args.limit or None, args.start_from):
            batch.append(record)
            if len(batch) == args.batch_size:
                await emit(batch)
                batch = []
        if batch:
            await emit(batch)
    finally:
        await connection.close()


def main():
    load_dotenv()
    asyncio.run(run())


if __name__ == "__main__":
    main()
