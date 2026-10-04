<div align="center">

<img src="logo.svg" alt="slop" width="420">

**Simple tools and vibecoding experiments.**
Small, sharp, and built fast.

<img src="chirp/docs/screenshots/desktop-landing.png" alt="Chirp landing page" width="720">

</div>

---

## Index

| Project | What it is | Stack |
| --- | --- | --- |
| [**chirp/**](chirp/) | A slick microblogging app with a dark glassmorphism UI, parallax, pointer tilt, and GPU-composited animation. Sign up, post (280 chars), reply, like, repost, and scroll an infinite global feed with optimistic updates. | React, Vite, Fastify, TypeScript, MySQL, Redis, Playwright |
| [**mkdownviewer/**](mkdownviewer/) | `mdview`: a desktop Markdown viewer that renders a `.md` file in a native window and live-reloads on save, preserving scroll position. Ships with a standalone browser editor + preview (`index.html`). | Python, PyQt6 (WebEngine) |

---

## 🐦 [chirp](chirp/)

A full-stack microblog. React + Vite on the front, a Fastify/TypeScript API behind it, **MySQL** as the source of truth and **Redis** as the cache. Mobile-ready, with the sidebar collapsing into a floating bottom bar.

```bash
cd chirp
docker compose up -d   # MySQL + Redis
npm install
npm run migrate
npm run dev            # API :3001, client :5173
```

| Path | Contents |
| --- | --- |
| [`chirp/client`](chirp/client) | React + Vite frontend |
| [`chirp/server`](chirp/server) | Fastify/TypeScript API, migrations |
| [`chirp/e2e`](chirp/e2e) | Playwright end-to-end and visual tests |
| [`chirp/docs`](chirp/docs) | Generated screenshots (desktop + mobile) |

Full details in the [chirp README](chirp/README.md).

## 📝 [mkdownviewer](mkdownviewer/)

A read-only, live-reloading Markdown viewer. Point it at a file, edit in your favorite editor, and watch the window update the moment you save. Links to other `.md` files open in the viewer; everything else goes to your browser.

```bash
cd mkdownviewer
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./mdview sample.md
```

| Path | Contents |
| --- | --- |
| [`mdview.py`](mkdownviewer/mdview.py) | The viewer itself |
| [`mdview`](mkdownviewer/mdview) | Thin launcher using the venv's interpreter |
| [`index.html`](mkdownviewer/index.html) | Standalone in-browser editor + preview |
| [`test_mdview.py`](mkdownviewer/test_mdview.py) | Tests |
| [`sample.md`](mkdownviewer/sample.md) | Demo document |

Full details in the [mdview README](mkdownviewer/README.md).

---

<div align="center">
<sub>Experiments in progress. Expect rough edges.</sub>
</div>
