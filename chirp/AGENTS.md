# AGENTS.md

Guidance for AI agents and contributors working on Chirp. Read this before changing code.

## What this is
A Twitter-style microblog. npm-workspaces monorepo:

| Path | Role |
| --- | --- |
| `server/` | Fastify 5 + TypeScript (ESM, `NodeNext`) API. MySQL = source of truth, Redis = cache. |
| `client/` | React 18 + Vite 5 + TypeScript SPA. TanStack Query, React Router 6, Framer Motion. Plain CSS (`client/src/styles/global.css`), no UI kit. |
| `e2e/` | Playwright specs (auth, posts, profile, visual). |
| `docs/screenshots/` | README images (tracked). `e2e/screenshots/` is the gitignored working copy. |
| `docker-compose.yml` | MySQL 8.4 + Redis 7 with healthchecks. |

Out of scope for v1 (do not assume they exist): follows / home timeline, realtime updates, search, image uploads, notifications.

## Setup and commands
Run from the repo root.

```bash
docker compose up -d     # MySQL :3306, Redis :6379. On a Debian apt install the command is `docker-compose`, and may need `sudo`
npm install
npm run migrate          # applies server/migrations/*.sql, tracked in the _migrations table
npm run dev              # API :3001 + client :5173 (Vite proxies /api -> :3001)

npm test                 # server integration tests (need containers + migrated DB)
npm run test:client      # Vitest + Testing Library (jsdom)
npm run test:e2e         # Playwright, projects: desktop + mobile (Pixel 7)
npm run test:all
npm run docs:screenshots # re-run visual spec and refresh docs/screenshots/
```

Type-check without emitting: `cd server && npx tsc --noEmit`, `cd client && npx tsc --noEmit`. Production client build: `cd client && npx vite build`.

Config is via env (see `.env.example`, loaded with `--env-file=../.env`): `PORT`, `MYSQL_URL`, `REDIS_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, plus `RATE_MAX` (default 300/min global) and `AUTH_RATE_MAX` (default 10/min on register/login). Defaults live in `server/src/config.ts`.

## Backend architecture (`server/src`)
- `app.ts` builds the app (helmet, cors with credentials, Redis-backed rate limit, auth plugin, error handler). `index.ts` just listens. Tests use `buildApp()` with `inject`.
- Error handler: `ZodError` -> 400 `{error, issues}`; errors with `statusCode < 500` pass through as `{error}`; everything else -> 500 generic. Throw `Object.assign(new Error(msg), { statusCode: 404 })` for expected failures.
- `plugins/auth.ts`: `@fastify/jwt` reading an httpOnly cookie `chirp_session` (7 days, `sameSite=lax`, `secure` only in production). JWT payload is `{ sub: userId }`. `app.requireAuth` is the preHandler for protected routes; `optionalViewer(req)` returns the viewer id for public routes that personalise output. Passwords use argon2.
- `routes/`: `auth.ts`, `users.ts`, `posts.ts`. Validate every input with zod; never trust `req.body`.
- `services/`: all data logic. Routes stay thin.
- `db/pool.ts` (mysql2 pool), `db/migrate.ts` (sorted `.sql` runner). **Add schema changes as a new `migrations/00N_*.sql`; never edit an applied migration.**

### API (all under `/api`)
| Method + path | Auth | Notes |
| --- | --- | --- |
| `GET /health` | no | |
| `POST /auth/register` `{username, displayName, password}` | no | username `^[A-Za-z0-9_]{3,30}$`, password 8-128; 409 on duplicate; rate limited |
| `POST /auth/login` `{username, password}` | no | rate limited |
| `POST /auth/logout`, `GET /auth/me` | me: yes | |
| `GET /users/:username`, `GET /users/:username/posts` | optional | cursor paging |
| `PATCH /users/me` `{displayName?, bio?, avatarUrl?}` | yes | |
| `GET /posts?limit&before` | optional | global feed of top-level posts and reposts |
| `POST /posts` `{body<=280, parentId?}` | yes | `parentId` makes it a reply |
| `GET /posts/:id` | optional | returns `{post, replies}` |
| `DELETE /posts/:id` | yes (owner) | 404 if not yours |
| `PUT/DELETE /posts/:id/like` | yes | idempotent |
| `POST/DELETE /posts/:id/repost` | yes | idempotent |

Pagination is **cursor-based on post id**: `limit` (1-50, default 20) and `before` (exclusive id); responses return `nextCursor` (null at the end). Do not switch to offsets.

### Data model (`migrations/001_init.sql`)
- `users`, `posts`, `likes`. A **reply** has `parent_id`; a **repost** has `repost_of_id` and an empty body; both live in `posts`.
- Counters (`like_count`, `reply_count`, `repost_count`) are denormalised on `posts` and **must be changed in the same transaction** as the row that causes them (see `withTx` in `postService.ts`). Use `GREATEST(x - 1, 0)` when decrementing.
- `UNIQUE (user_id, repost_of_id)` plus `INSERT IGNORE` makes reposting idempotent. Reposting a repost reposts the original.
- Replies are excluded from the global feed and profile post lists (`parent_id IS NULL`).

### Caching rules (the part most likely to bite)
MySQL is authoritative; Redis is best-effort. Every Redis call goes through `safe()` / `getOrSet()` in `cache/redis.ts` so a Redis outage degrades to MySQL instead of 500ing. Keep it that way.

- `feed:global`: sorted set, member and score = post id, capped at 1000 (`FEED_MAX`). `getFeed` falls back to MySQL when the set is empty or can't fill a page, and warms the cache on a cold first-page read.
- `post:{id}` (600s), `user:id:{id}` / `user:name:{username lowercased}` (300s): JSON, read-through.
- **Cached posts are viewer-independent.** `likedByMe` / `repostedByMe` are computed per request in `hydrate()` from MySQL. Never put viewer state into a cache key or value.
- A cached repost **embeds the original post**, so any change to an original (like, repost, reply count, delete) must also invalidate its reposts: call `refresh(id)` and `invalidateReposts(id)` as `setLike`/`repost`/`unrepost` do.
- Write order: MySQL transaction first, then cache update/invalidate. Deleting a post cascades in MySQL; cached copies of cascaded rows expire via TTL.
- Profile edits call `invalidateUser`; embedded `author` objects in cached posts can stay stale until TTL. That is accepted.

## Frontend architecture (`client/src`)
- `main.tsx`: QueryClient (retry only for non-`ApiError` or 5xx errors, max 2 tries; **4xx must not retry** or error pages feel broken), Router, `AuthProvider`.
- `api/client.ts`: the only place that calls `fetch`. Always `credentials: 'include'`; non-2xx throws `ApiError(status, message)` using the server's `error` field. Requests go to relative `/api` (Vite proxy in dev).
- `hooks/useAuth.tsx`: `['me']` query; 401 maps to `user = null`. `setUser` also invalidates feeds.
- `hooks/usePostActions.ts`: optimistic like/repost/delete. `patchAll` rewrites every cached shape (`['feed']`, `['userPosts']`, `['post']`) and also patches a repost's embedded original. On error it rolls back from a snapshot. Keep new post-related queries under those key prefixes so they are patched too.
- `App.tsx`: logged-in routes render inside `Layout`; logged-out users only see `AuthPage` and everything else redirects to `/`.
- `components/`: `Aurora` (fixed parallax backdrop), `Tilt` (pointer tilt + highlight), `PostCard`, `Composer`, `Feed` (infinite scroll via IntersectionObserver), `Layout` (sidebar, becomes a floating bottom bar under 800px), `Avatar`.

### Motion and GPU rules
- Animate **only `transform` and `opacity`** (and filters on already-promoted layers). Never animate `top/left/width/height/margin`; it causes layout and kills the compositor path.
- Animated layers set `will-change: transform` (and `translateZ(0)` where needed). Parallax uses Framer Motion `useScroll` + `useTransform` / `useSpring`.
- Respect `prefers-reduced-motion`: `Aurora` and `Tilt` check `useReducedMotion()`, and `global.css` has a reduce media query. New motion must honour it.
- **Do not wrap `<Routes>` in `<AnimatePresence mode="wait">`**: it hung waiting for an exit animation and left a blank screen after log out then log in. Use entrance animations instead.
- **Do not use `content-visibility: auto` on feed items**: its height guess made the scroll height jump while scrolling.
- Long text must wrap (`overflow-wrap: anywhere`); there must be no horizontal scroll at any width (the visual spec asserts this).

### Visual language
Tokens are CSS variables at the top of `global.css`: near-black background, violet / cyan / pink / green accents, `.glass` panels (blur + saturate, with an opaque fallback via `@supports`). Sticky/fixed chrome (`.topbar`, mobile `.rail`) needs a mostly opaque background so scrolling content does not bleed through. Font is Inter.

## Testing guidance
- **Server** (`server/src/api.test.ts`): real MySQL + Redis, no mocks. Creates uniquely named users and cleans up. Covers auth, idempotent likes/reposts, counters, and the cold-cache fallback.
- **Client** (`*.test.tsx`): `src/test/utils.tsx` has `renderApp` (Router + QueryClient + AuthProvider) and `mockApi({'METHOD /api/path': [status, body]})` which stubs `fetch`. jsdom lacks `matchMedia` and `IntersectionObserver`; `src/test/setup.ts` polyfills them. Vitest is pinned to `^2` to match Vite 5; Vitest 3+ needs Vite 6.
- **E2E** (`e2e/`): runs against the real stack. Playwright starts both servers with `RATE_MAX=100000 AUTH_RATE_MAX=100000`.
  - Specs share one database and run in parallel. Use unique usernames and post text (`uniq()` in `helpers.ts`). Never assert on exact feed contents.
  - Do not look for another user's post in the **global feed**; it may be beyond the first page. Open the author's profile (`/u/:username`) instead.
  - After `post()`, the helper waits for the composer to clear. Keep that; without it, a stale identical post lets the next step race the pending mutation.
  - Locators: use `getByRole('link', { name: 'Profile', exact: true })` (author names can contain "Profile").
  - The `visual` spec writes screenshots to `e2e/screenshots/` and also asserts: no horizontal overflow, `backdrop-filter` blur present, GPU hints set, aurora layers move at different speeds on scroll, and reduced motion freezes them. When you change the UI, run it and **look at the screenshots**.

## Gotchas
- Playwright is configured with `reuseExistingServer`. A stale dev server on :3001 or :5173 (especially one with default rate limits) makes e2e fail with 429s or flakes. Stop it first, e.g. find the pid with `ss -ltnp | grep -E ':(3001|5173)'` and `kill` it. Avoid `pkill -f <pattern>` in a shell command; it can match and kill your own shell.
- Node lives in `~/.local/node/bin` on the dev machine; make sure it is on `PATH` in non-login shells.
- `.env` is gitignored; `.env.example` is the template. Never commit secrets. The default `JWT_SECRET` is for local dev only.
- `npm audit` currently reports vulnerabilities in transitive dev dependencies; do not run `npm audit fix --force` blindly.

## Definition of done
1. `npm test`, `npm run test:client`, and `npm run test:e2e` pass (no new flakiness: try `--repeat-each=2`).
2. Both workspaces type-check, and `vite build` succeeds.
3. UI changes: screenshots reviewed on desktop and mobile; `npm run docs:screenshots` if the README images are now out of date.
4. New endpoints are zod-validated, covered by a server test, and listed in the API table above. New caching follows the rules above.
