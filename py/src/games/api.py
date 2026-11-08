import json
import logging
import math
import os
from contextlib import asynccontextmanager
from typing import Annotated

import asyncpg
import numpy as np
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    load_dotenv()
    app.state.pool = await asyncpg.create_pool(
        os.environ["DATABASE_URL"],
        min_size=1,
        max_size=5,
        timeout=15,
        command_timeout=60,
    )
    try:
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(lifespan=lifespan)
load_dotenv()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


class ComparedGame(BaseModel):
    appid: int
    name: str


@app.get("/games", response_model=list[ComparedGame])
async def search_games(request: Request, q: Annotated[str, Query(min_length=2, max_length=200)]):
    q = q.strip()
    if len(q) < 2:
        raise HTTPException(422, detail="Enter at least two characters")
    try:
        async with request.app.state.pool.acquire() as connection:
            rows = await connection.fetch(
                """SELECT appid, name FROM steam_game_embeddings_06b
                WHERE strpos(lower(name), lower($1)) > 0 OR appid::text = $1
                ORDER BY (lower(name) = lower($1)) DESC,
                         (strpos(lower(name), lower($1)) = 1) DESC, lower(name), appid
                LIMIT 20""",
                q,
            )
        return [dict(row) for row in rows]
    except asyncpg.PostgresError, OSError, TimeoutError:
        logger.exception("Game search failed")
        raise HTTPException(503, detail="Game search unavailable") from None


class GamePair(BaseModel):
    source: ComparedGame
    target: ComparedGame
    similarity: float = Field(ge=-1, le=1)


class GameComparison(BaseModel):
    pairs: list[GamePair]
    average_similarity: float = Field(ge=-1, le=1)


@app.post("/compare", response_model=GameComparison)
async def compare(
    request: Request,
    appids: Annotated[
        list[Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)]],
        Body(min_length=2, max_length=100, examples=[[730, 570, 440]]),
    ],
):
    appids = list(dict.fromkeys(appids))
    if not 2 <= len(appids) <= 3:
        raise HTTPException(422, detail="Provide two or three distinct appids")
    try:
        async with (
            request.app.state.pool.acquire() as connection,
            connection.transaction(readonly=True),
        ):
            found = await connection.fetch(
                "SELECT appid FROM steam_game_embeddings_06b WHERE appid = ANY($1::bigint[])",
                appids,
            )
            missing = sorted(set(appids) - {row["appid"] for row in found})
            if missing:
                raise HTTPException(404, detail={"missing_appids": missing})
            rows = await connection.fetch(
                """
                WITH selected AS (
                    SELECT g.appid, g.name, g.embedding, input.position
                    FROM unnest($1::bigint[]) WITH ORDINALITY AS input(appid, position)
                    JOIN steam_game_embeddings_06b g ON g.appid = input.appid
                )
                SELECT a.appid AS source_appid, a.name AS source_name,
                       b.appid AS target_appid, b.name AS target_name,
                       1 - (a.embedding <=> b.embedding) AS similarity
                FROM selected a JOIN selected b ON a.position < b.position
                ORDER BY a.position, b.position
                """,
                appids,
            )
        # Null/zero embeddings have no cosine similarity.
        if len(rows) != len(appids) * (len(appids) - 1) // 2 or any(
            row["similarity"] is None or not math.isfinite(row["similarity"])
            for row in rows
        ):
            raise HTTPException(
                422, detail="Some games have embeddings that cannot be compared"
            )
        pairs = [
            GamePair(
                source=ComparedGame(appid=row["source_appid"], name=row["source_name"]),
                target=ComparedGame(appid=row["target_appid"], name=row["target_name"]),
                similarity=max(-1.0, min(1.0, row["similarity"])),
            )
            for row in rows
        ]
        return GameComparison(
            pairs=pairs,
            average_similarity=sum(pair.similarity for pair in pairs) / len(pairs),
        )
    except asyncpg.PostgresError, OSError, TimeoutError:
        logger.exception("Game comparison query failed")
        raise HTTPException(503, detail="Database query failed") from None


class SimilarGame(BaseModel):
    appid: int
    name: str
    similarity: float


@app.post("/similar", response_model=list[SimilarGame])
async def similar(
    request: Request,
    appids: Annotated[
        list[Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)]],
        Body(min_length=1, max_length=100, examples=[[715560, 1110050]]),
    ],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    appids = list(dict.fromkeys(appids))
    try:
        async with (
            request.app.state.pool.acquire() as connection,
            connection.transaction(readonly=True),
        ):
            found = await connection.fetch(
                "SELECT appid FROM steam_game_embeddings_06b WHERE appid = ANY($1::bigint[])",
                appids,
            )
            missing = sorted(set(appids) - {row["appid"] for row in found})
            if missing:
                raise HTTPException(404, detail={"missing_appids": missing})
            rows = await connection.fetch(
                """
                WITH query AS (
                    SELECT avg(embedding) AS embedding
                    FROM steam_game_embeddings_06b
                    WHERE appid = ANY($1::bigint[])
                )
                SELECT g.appid, g.name,
                       1 - (g.embedding <=> query.embedding) AS similarity
                FROM steam_game_embeddings_06b g CROSS JOIN query
                WHERE NOT (g.appid = ANY($1::bigint[]))
                  AND (g.embedding <=> query.embedding) IS NOT NULL
                  AND (g.embedding <=> query.embedding) < 'Infinity'::float8
                ORDER BY g.embedding <=> query.embedding, g.appid
                LIMIT $2
                """,
                appids,
                limit,
            )
        return [dict(row) for row in rows]
    except asyncpg.PostgresError, OSError, TimeoutError:
        logger.exception("Similarity query failed")
        raise HTTPException(503, detail="Database query failed") from None


def project_embeddings(rows):
    """One shared linear projection for source games, matches, and blend markers."""
    if not rows:
        raise HTTPException(
            422, detail="No embeddings available for the personal graph"
        )
    vectors = np.asarray([json.loads(row["embedding"]) for row in rows], dtype=float)
    if not np.isfinite(vectors).all() or np.any(np.linalg.norm(vectors, axis=1) == 0):
        raise HTTPException(422, detail="Some games have invalid embeddings")
    centered = vectors - vectors.mean(axis=0)
    _, _, axes = np.linalg.svd(centered, full_matrices=False)
    projected = centered @ axes[:3].T
    # Axis sign is arbitrary in SVD: keep orientations deterministic.
    for axis in range(projected.shape[1]):
        largest = np.argmax(np.abs(axes[axis]))
        if axes[axis, largest] < 0:
            projected[:, axis] *= -1
    projected = np.pad(projected, ((0, 0), (0, 3 - projected.shape[1])))
    # One scale for all dimensions preserves relative projected distances.
    span = max(float(np.ptp(projected, axis=0).max()), 1e-9)
    projected = projected / span
    return [
        {
            "appid": row["appid"],
            "x": float(point[0]),
            "y": float(point[1]),
            "z": float(point[2]),
        }
        for row, point in zip(rows, projected)
    ]


class ConnectionRequest(BaseModel):
    appids: list[Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)]] = (
        Field(min_length=1)
    )
    minutes: list[Annotated[float, Field(ge=0, allow_inf_nan=False)]] = Field(
        min_length=1
    )
    weighted: bool = False


@app.post("/connections")
async def connections(request: Request, body: ConnectionRequest):
    from itertools import combinations

    if len(set(body.appids)) != len(body.appids) or len(body.minutes) != len(
        body.appids
    ):
        raise HTTPException(
            422, detail="Provide distinct appids and one playtime per game"
        )
    comparison = await compare(request, body.appids) if 1 < len(body.appids) <= 3 else None
    groups = []
    try:
        async with request.app.state.pool.acquire() as connection:
            # Check single-game inputs too; compare checks larger inputs.
            found = await connection.fetch(
                "SELECT appid FROM steam_game_embeddings_06b WHERE appid = ANY($1::bigint[])",
                body.appids,
            )
            missing = sorted(set(body.appids) - {row["appid"] for row in found})
            if missing:
                raise HTTPException(404, detail={"missing_appids": missing})
            selections = (
                (indices for size in range(min(2, len(body.appids)), len(body.appids) + 1)
                 for indices in combinations(range(len(body.appids)), size))
                if len(body.appids) <= 3 else [tuple(range(len(body.appids)))]
            )
            for indices in selections:
                size = len(indices)
                ids = [body.appids[i] for i in indices]
                times = [body.minutes[i] for i in indices]
                total_time = sum(times)
                # A=3, B=2 means 3/5 towards B: coefficients A=2/5, B=3/5.
                weights = (
                    [total_time - t for t in times]
                    if body.weighted and size > 1
                    else [1.0] * size
                )
                total = sum(weights)
                weights = (
                    [w / total for w in weights] if total else [1 / size] * size
                )
                rows = await connection.fetch(
                    """
                    WITH dimensions AS (
                        SELECT component.dimension, sum(component.value * input.weight)::real AS value
                        FROM unnest($1::bigint[], $2::float8[]) AS input(appid, weight)
                        JOIN steam_game_embeddings_06b g ON g.appid = input.appid
                        CROSS JOIN LATERAL unnest(g.embedding::real[]) WITH ORDINALITY AS component(value, dimension)
                        GROUP BY component.dimension
                    ), query AS (
                        SELECT array_agg(value ORDER BY dimension)::vector AS embedding FROM dimensions
                    )
                    SELECT g.appid, g.name, 1 - (g.embedding <=> query.embedding) AS similarity
                    FROM steam_game_embeddings_06b g CROSS JOIN query
                    WHERE NOT (g.appid = ANY($3::bigint[]))
                      AND (g.embedding <=> query.embedding) < 'Infinity'::float8
                    ORDER BY g.embedding <=> query.embedding, g.appid
                    LIMIT 3
                    """,
                    ids,
                    weights,
                    body.appids,
                )
                groups.append(
                    {
                        "appids": ids,
                        "weights": weights,
                        "matches": [dict(row) for row in rows],
                    }
                )
            graph_ids = sorted(
                set(body.appids)
                | {match["appid"] for group in groups for match in group["matches"]}
            )
            layout = []
            if len(body.appids) <= 3:
                embeddings = await connection.fetch(
                    "SELECT appid, embedding::text AS embedding FROM steam_game_embeddings_06b WHERE appid = ANY($1::bigint[]) ORDER BY appid",
                    graph_ids,
                )
                if {row["appid"] for row in embeddings} != set(graph_ids):
                    raise HTTPException(422, detail="Some graph games have no embeddings")
                layout = project_embeddings(embeddings)
        return {
            "pairs": comparison.pairs if comparison else [],
            "average_similarity": comparison.average_similarity if comparison else None,
            "groups": groups,
            "weighted": body.weighted,
            "layout": layout,
            "layout_method": "pca",
            "layout_dimensions": 3,
        }
    except asyncpg.PostgresError, OSError, TimeoutError:
        logger.exception("Connection query failed")
        raise HTTPException(503, detail="Database query failed") from None
