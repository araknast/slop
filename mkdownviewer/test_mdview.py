from mdview import md, render

out = md.render(open("sample.md").read())
for frag in ['<h1 id="top">Markdown Viewer</h1>', "<em>italic</em>", "<strong>bold</strong>", "<s>strike</s>",
             "<mark>highlight</mark>", "H<sub>2</sub>O", "x<sup>2</sup>", "<br", "“quotes”", "–", "©", 'id="h6"',
             'type="checkbox"', 'style="text-align:center"', 'href="https://autolinked.com"', '<img src=',
             '<code class="language-python"><span class="k">def', 'class="mermaid"', "<blockquote>", "markdown-alert-note", "<dl>",
             'class="math inline"', 'class="math block"', 'class="lead"', "footnote-ref", "<details>", "<hr",
             "<pre><code>indented code block"]:
    assert frag in out, frag
assert "front matter is hidden" not in out
assert "a == b" in md.render("a == b")  # lone == is not a highlight
assert "<code>==x==</code>" in md.render("`==x==`")
assert render("# x").startswith("<!doctype html>")
print("ok")
