# mdview

A desktop Markdown viewer. Renders a `.md` file in a native window (Qt WebEngine) and reloads it live as you save — like a live preview, but read-only and pointing at a file on disk instead of a side-by-side editor.

There is also `index.html`: a standalone browser-based editor + preview if you just want something to open in a tab.

## Install

Requires Python 3.10+ and a venv:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

PyQt6 pulls in WebEngine, which renders the page.

## Usage

```sh
./mdview                # opens a file picker
./mdview README.md      # opens that file
./mdview a.md b.md       # extra args are ignored
```

`mdview` is a thin wrapper that runs `mdview.py` with the venv's interpreter.

### Keyboard

| Shortcut | Action |
|---|---|
| `Ctrl+O` | Open a file |
| `Ctrl+R` / `F5` | Reload from disk |
| `Ctrl++` / `Ctrl+=` / `Ctrl+-` | Zoom |
| `Ctrl+0` | Reset zoom |
| `Ctrl+Q` | Quit |

Editing in another program and saving re-renders the window, preserving your scroll position. Links to other `.md` files on disk open in the viewer; everything else opens in your normal browser.

## What it supports

Built on `markdown-it-py` with the CommonMark spec plus the plugin set you actually use on GitHub:

- Tables, strikethrough, task lists, autolinks, footnotes, front matter (hidden)
- Typographer: smart quotes, dashes, `(c)` → `©`
- `==highlight==`, `H~2~O` subscript, `x^2^` superscript
- Definition lists (`Term` / `: def`)
- GitHub alerts (`> [!NOTE]`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`)
- `$inline$` and `$$block$$` math via KaTeX
- ```` ```mermaid ```` diagrams via Mermaid
- Fenced code highlighted by Pygments (GitHub Dark)
- `{#custom-id}` on headings, `{.class}` attribute lines
- Raw HTML passes through (`html=True`)

Styling is GitHub-dark, defined inline in `mdview.py` — no separate theme files to maintain.

Math and Mermaid load KaTeX/Mermaid from a CDN at runtime; offline you get raw TeX and diagram source instead. Everything else works with no network.

## Development

```
mdview.py         renderer + app entry point
index.html        standalone browser editor/preview
sample.md         feature sample used by the test
test_mdview.py    assertions against sample.md
```

`mdview.py` splits into two halves: the top half is pure rendering (`md` is a configured `MarkdownIt`, `render()` returns a full HTML document) and imports nothing from Qt. `main()` imports PyQt6 lazily so the render half stays usable — and testable — without a GUI stack.

Run the tests:

```sh
.venv/bin/python test_mdview.py   # prints "ok"
```

Open `sample.md` in the viewer to eyeball every feature at once.

## Notes / limits

- `setHtml` truncates around 2 MB of HTML. Very large files should be written to a temp file and `load()`ed instead (`mdview.py:146`).
- The `==highlight==` rule closes at the next `==` and ignores nesting — fine for the common case, not for pathological input (`mdview.py:31`).
- The file watcher is re-added on every load because editors that save-by-rename drop the watch (`mdview.py:144`).
- Raw HTML is enabled, so a `.md` file from an untrusted source can inject script into the viewer window. It renders with local file access enabled, so treat opened files as trusted.
