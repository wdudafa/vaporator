import argparse
import csv
import json
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent


def analyse(records, neighbors=10):
    """Return indices and scores;"""
    if len(records) < 2:
        raise ValueError("Need at least two games")
    ids = np.array([int(row["appid"]) for row in records], dtype=np.int64)
    points = np.array(
        [[row[axis] for axis in ("x", "y", "z")] for row in records], dtype=float
    )
    if len(np.unique(ids)) != len(ids):
        raise ValueError("Duplicate appids would weight some games more than once")
    if not np.isfinite(points).all():
        raise ValueError("Coordinates must all be finite")
    if neighbors < 1:
        raise ValueError("neighbors must be positive")
    k = min(neighbors, len(points) - 1)
    distances, indices = cKDTree(points).query(points, k=k + 1)
    distances[indices == np.arange(len(points))[:, None]] = np.inf
    distances.sort(axis=1)
    local = distances[:, :k].mean(axis=1)
    centroid = points.mean(axis=0)
    central = np.linalg.norm(points - centroid, axis=1)
    return {
        "ids": ids,
        "points": points,
        "neighbors": k,
        "centroid": centroid,
        "local": local,
        "central": central,
        "nearest": distances[:, 0],
        "unique": np.lexsort((ids, -local)),
        "average": np.lexsort((ids, central)),
        "densest": np.lexsort((ids, local)),
    }


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--coordinates",
        type=Path,
        default=ROOT.parent / "vaporator/coordinates_umap_xyz.json",
    )
    parser.add_argument(
        "--names",
        type=Path,
        default=ROOT / "data/games.csv",
        help="CSV containing AppID and Name",
    )
    parser.add_argument("--neighbors", type=int, default=10)
    parser.add_argument("--top", type=int, default=5)
    args = parser.parse_args()
    if args.top < 1 or args.neighbors < 1:
        parser.error("--top and --neighbors must be positive")
    try:
        with args.coordinates.open() as source:
            result = analyse(json.load(source), args.neighbors)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.error(str(error))
    selected = set(
        int(result["ids"][i])
        for key in ("unique", "average", "densest")
        for i in result[key][: args.top]
    )
    names = {}
    if args.names.exists():
        # Stream the large source CSV; only retain titles needed for this report.
        with args.names.open(newline="", encoding="utf-8-sig") as source:
            for row in csv.DictReader(source):
                appid = int(row["AppID"])
                if appid in selected:
                    names[appid] = row["Name"]
    print(
        f"Map: {args.coordinates}\nGames: {len(result['ids']):,}; neighbours: {result['neighbors']}"
    )
    print("Centroid XYZ:", ", ".join(f"{x:.6f}" for x in result["centroid"]))
    print(
        "Distances use map units. Rankings describe this projection, not creativity or quality."
    )
    if not args.names.exists():
        print(f"Title CSV unavailable: {args.names}; showing appids.")
    for key, title in (
        ("unique", "Most unique (largest mean neighbour distance)"),
        ("average", "Most average (closest to centroid)"),
        ("densest", "Densest neighbourhood (smallest mean neighbour distance)"),
    ):
        print(f"\n{title}:")
        for rank, i in enumerate(result[key][: args.top], 1):
            appid = int(result["ids"][i])
            print(
                f"  {rank}. {names.get(appid, '(title unavailable)')} [appid {appid}]"
            )
            print(
                f"     mean neighbour={result['local'][i]:.8f}; nearest={result['nearest'][i]:.8f}; centroid={result['central'][i]:.8f}"
            )
            print("     XYZ=" + ", ".join(f"{x:.6f}" for x in result["points"][i]))
            print(f"     https://store.steampowered.com/app/{appid}/")


if __name__ == "__main__":
    main()
