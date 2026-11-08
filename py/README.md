# Games

Python backend/data.

```sh
cd py  # repository root
uv sync
uv run uvicorn games.api:app --reload
```

Set `DATABASE_URL` in a local `.env` file.
Uses postgres with PGVector, needs cuda.


We use SentenceTransformer with Qwen3-Embedding 0.6B, initially tried
to use 8b but the embeddings were taking too long on my laptop.
I had to buffer the steam database 65k characters at a time as
reading the whole dataset caused some issues.

We embed the tags, title, description, summary etc in the embedding.

We add the pgvector extension to tigerdata and add the embeddings in batches
to it, it was done on my laptop and took 10 & 1/2 hours. 


Initially I tried to create a spring_layout map usign the cosime similarity of the
all the nearest neighbours, turns out 2^150000 is quite slow so I tried five nearest neighbours,
but ended up having to use another method as only using
the five nearest neighbours ended up in a terrible looking graph.

The newer method used UMAP instead of sprint layout, I used pca (principle component analyris)
to reduce the dimensionality of the nodes to at most 50 dimentions, then normalizes them.
Then it uses UMAP to compress these into XYZ coordinates and uses 30 neighbours, this was much 
faster and had a better result.
normalizing them from 0-1 and sacing them



For the extremes, to find the most Average, Unique and dense I used the
largest mean distance to the k nearest other games, 

It uses a api runnign on my laptop with a cloudflare tunnel, which takes an array
of games the user has played, searches for thie embeddings and caluclates the similarities
between then using a PGVector query.


We use IPC or Apache Arrow interprocess Communication to precompute the graph for cosmograph at
build time as there are 150k nodes, having a datatype that copies would be very slow.


So the full flow is embeddings -> PCA reduced ->  UMAP graph -> IPC File -> browser map


Most average
Average every game’s X, Y and Z, then find the game closest to that point
Tung Tung Tung Survival 

Most unique
Find each game’s 10 nearest neighbours and average their distances; pick the largest average
Tomb Raider II (1997) 


Densest neighbourhood
Use the same neighbour distances, but pick the smallest average
GG Land Playtest 
