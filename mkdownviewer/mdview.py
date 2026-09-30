#!/usr/bin/env python3
"""mdview - desktop Markdown viewer.  Usage: mdview [FILE.md]"""
import html
import re
import sys
from pathlib import Path

from markdown_it import MarkdownIt
from mdit_py_plugins.anchors import anchors_plugin
from mdit_py_plugins.attrs import attrs_block_plugin, attrs_plugin
from mdit_py_plugins.deflist import deflist_plugin
from mdit_py_plugins.gfm import gfm_plugin
from mdit_py_plugins.subscript import sub_plugin
from mdit_py_plugins.superscript import superscript_plugin
from pygments import highlight as pyg_highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import get_lexer_by_name
from pygments.util import ClassNotFound


def highlight(code, lang, _attrs):
    if lang == "mermaid":
        return f'<pre class="mermaid">{html.escape(code)}</pre>'
    try:
        return pyg_highlight(code, get_lexer_by_name(lang), HtmlFormatter(nowrap=True))
    except ClassNotFound:
        return ""  # markdown-it falls back to a plain escaped <pre><code>


def mark_rule(state, silent):
    # ponytail: ==text== closes at the next "==", ignoring nesting; good enough for highlights.
    src, pos = state.src, state.pos
    if not src.startswith("==", pos):
        return False
    end = src.find("==", pos + 2)
    if end <= pos + 2 or end > state.posMax:
        return False
    if not silent:
        state.push("mark_open", "mark", 1)
        old_max, state.pos, state.posMax = state.posMax, pos + 2, end
        state.md.inline.tokenize(state)
        state.posMax = old_max
        state.push("mark_close", "mark", -1)
    state.pos = end + 2
    return True


def heading_id_rule(state):
    # "# Title {#custom-id}" -> <h1 id="custom-id">Title</h1> (overrides the auto slug)
    for i, tok in enumerate(state.tokens):
        if tok.type != "heading_open":
            continue
        inline = state.tokens[i + 1]
        last = next((c for c in reversed(inline.children or []) if c.type == "text"), None)
        m = last and re.search(r"\s*\{#([\w\-:.]+)\}\s*$", last.content)
        if m:
            last.content = last.content[: m.start()]
            tok.attrSet("id", m.group(1))


md = (
    MarkdownIt("commonmark", {"html": True, "linkify": True, "typographer": True, "highlight": highlight})
    .use(gfm_plugin, dollarmath=True, front_matter=True)
    .use(deflist_plugin)
    .use(sub_plugin)
    .use(superscript_plugin)
    .use(attrs_plugin)
    .use(attrs_block_plugin)
    .use(anchors_plugin, max_level=6)
)
md.enable(["replacements", "smartquotes"])  # the commonmark preset leaves typographer rules off
md.options["strikethrough_single_tilde"] = False  # frees ~x~ for subscript; ~~x~~ still strikes
md.inline.ruler.before("emphasis", "mark", mark_rule)
md.core.ruler.push("heading_id", heading_id_rule)

CSS = """
:root { color-scheme: dark; --fg:#e6edf3; --bg:#0d1117; --muted:#9198a1; --border:#3d444d; --code:#151b23; --link:#4493f8; --mark:#bb800966; }
body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--fg); background: var(--bg); max-width: 900px; margin: 0 auto; padding: 2rem; }
a { color: var(--link); } h1,h2 { border-bottom: 1px solid var(--border); padding-bottom: .3em; }
h1,h2,h3,h4,h5,h6 { margin: 1.5em 0 .5em; line-height: 1.25; } h6 { color: var(--muted); }
code, pre { font: 85% ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--code); border-radius: 6px; }
code { padding: .2em .4em; } pre { padding: 1em; overflow: auto; line-height: 1.45; } pre code { padding: 0; background: none; font-size: 100%; }
blockquote { margin: 0; padding: 0 1em; color: var(--muted); border-left: .25em solid var(--border); }
table { border-collapse: collapse; display: block; overflow: auto; } th, td { border: 1px solid var(--border); padding: 6px 13px; }
tr:nth-child(2n) { background: var(--code); } img { max-width: 100%; } hr { border: 0; border-top: 2px solid var(--border); }
mark { background: var(--mark); color: inherit; } dt { font-weight: 600; } dd { margin: 0 0 1em 1.5em; }
.header-anchor { display: none; } .contains-task-list { list-style: none; padding-left: 1.2em; } .task-list-item-checkbox { margin: 0 .3em 0 -1.2em; }
.footnotes { font-size: 85%; color: var(--muted); border-top: 1px solid var(--border); margin-top: 2em; }
.markdown-alert { padding: .5em 1em; margin-bottom: 1em; border-left: .25em solid; }
.markdown-alert-title { font-weight: 600; margin: 0; }
.markdown-alert-note { border-color: #0969da; } .markdown-alert-tip { border-color: #1a7f37; } .markdown-alert-important { border-color: #8250df; }
.markdown-alert-warning { border-color: #9a6700; } .markdown-alert-caution { border-color: #d1242f; }
.math.block { overflow-x: auto; margin: 1em 0; }
"""
PYGMENTS = HtmlFormatter(style="github-dark").get_style_defs("pre code")

# Math and Mermaid load from a CDN; offline they degrade to raw TeX / diagram source.
SCRIPTS = """
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"></script>
<script type="module">
  if (window.katex) document.querySelectorAll('.math').forEach(el =>
    katex.render(el.textContent, el, {displayMode: el.classList.contains('block'), throwOnError: false}));
  if (document.querySelector('.mermaid')) {
    const {default: mermaid} = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
    mermaid.initialize({startOnLoad: false, theme: 'dark'});
    await mermaid.run();
  }
</script>
"""


def render(text, title="", scroll=0):
    return (f"<!doctype html><html><head><meta charset='utf-8'><title>{html.escape(title)}</title>"
            f"<style>{CSS}{PYGMENTS}</style></head><body>{md.render(text)}{SCRIPTS}"
            f"<script>addEventListener('load', () => scrollTo(0, {int(scroll)}))</script></body></html>")


def main():
    from PyQt6.QtCore import QFileSystemWatcher, QUrl
    from PyQt6.QtGui import QColor, QDesktopServices, QKeySequence, QShortcut
    from PyQt6.QtWebEngineCore import QWebEnginePage, QWebEngineSettings
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    from PyQt6.QtWidgets import QApplication, QFileDialog, QMainWindow, QMessageBox

    app = QApplication(sys.argv)
    win, view = QMainWindow(), QWebEngineView()
    win.setCentralWidget(view)
    win.resize(1000, 800)
    view.settings().setAttribute(QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True)
    watcher = QFileSystemWatcher()
    state = {"path": None}

    def load(path, scroll=0):
        path = Path(path).resolve()
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            QMessageBox.critical(win, "mdview", f"Cannot open {path}:\n{e}")
            return
        if state["path"] and state["path"] != path:
            watcher.removePath(str(state["path"]))
        state["path"] = path
        watcher.addPath(str(path))  # re-added each load: editors that save by rename drop the watch
        win.setWindowTitle(f"{path.name} - mdview")
        # ponytail: setHtml caps at 2 MB of HTML; write a temp file and view.load() it if that ever bites.
        view.setHtml(render(text, path.name, scroll), QUrl.fromLocalFile(str(path)))

    def reload(*_):
        if state["path"]:
            view.page().runJavaScript("scrollY", lambda y: load(state["path"], y or 0))

    def open_dialog():
        f, _ = QFileDialog.getOpenFileName(win, "Open Markdown", "", "Markdown (*.md *.markdown *.mdown *.txt);;All files (*)")
        if f:
            load(f)

    class Page(QWebEnginePage):
        def acceptNavigationRequest(self, url, nav_type, is_main_frame):
            if nav_type != QWebEnginePage.NavigationType.NavigationTypeLinkClicked:
                return True
            if url.isLocalFile() and state["path"] and Path(url.toLocalFile()) == state["path"]:
                return True  # in-page #anchor
            if url.isLocalFile() and Path(url.toLocalFile()).suffix.lower() in (".md", ".markdown", ".mdown"):
                load(url.toLocalFile())
            else:
                QDesktopServices.openUrl(url)
            return False

    view.setPage(Page(view))
    view.page().setBackgroundColor(QColor("#0d1117"))  # no white flash before the page paints
    watcher.fileChanged.connect(reload)
    for keys, fn in (("Ctrl+O", open_dialog), ("Ctrl+R", reload), ("F5", reload), ("Ctrl+Q", app.quit),
                     ("Ctrl+=", lambda: view.setZoomFactor(view.zoomFactor() + 0.1)),
                     ("Ctrl++", lambda: view.setZoomFactor(view.zoomFactor() + 0.1)),
                     ("Ctrl+-", lambda: view.setZoomFactor(max(0.3, view.zoomFactor() - 0.1))),
                     ("Ctrl+0", lambda: view.setZoomFactor(1.0))):
        QShortcut(QKeySequence(keys), win, fn)

    win.show()
    if len(sys.argv) > 1:
        load(sys.argv[1])
    else:
        open_dialog()
        if not state["path"]:
            return 0
    return app.exec()


if __name__ == "__main__":
    sys.exit(main())
