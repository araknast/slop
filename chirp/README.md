# Chirp

Microblogging app: React + Vite client, Fastify/TypeScript API, MySQL (source of truth), Redis (cache).

## Run
```bash
docker compose up -d        # MySQL + Redis
npm install
npm run migrate
npm run dev                 # API :3001, client :5173 (proxies /api)
npm test                    # API integration tests (needs the containers)
```
Requires Node 22+. Copy `.env.example` to `.env` and set `JWT_SECRET` for anything non-local.

## Caching
- `feed:global` – Redis sorted set of top-level post ids (capped at 1000); falls back to MySQL when cold/down.
- `post:{id}`, `user:id:{id}`, `user:name:{name}` – read-through JSON with TTL, invalidated on writes.
- Per-viewer like/repost state is always read from MySQL, never cached globally.

## Motion
Parallax layers (`Aurora`), pointer tilt (`Tilt`) and aurora drift animate only `transform`/`opacity` with `will-change`
so they stay on the GPU compositor; `prefers-reduced-motion` disables them. Long feeds use `content-visibility: auto`.
