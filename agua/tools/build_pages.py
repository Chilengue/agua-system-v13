#!/usr/bin/env python3
"""Monta as páginas: esqueleto comum + conteúdo de tools/pages/<nome>.html."""
import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools/pages"
OUT = ROOT / "src/main/resources/pages"

HEAD = """<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0f1a17">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/img/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/app.css">{css}
  <title>{title} · AguaSystem</title>
</head>
"""
APP = HEAD + """<body>
  <div class="app">
    <aside class="sidebar"></aside>
    <main class="main-content">
      <header class="topbar"></header>
      <section id="content">
{body}
      </section>
    </main>
  </div>
  <script src="/js/app.js"></script>
{scripts}</body>
</html>
"""
PLAIN = HEAD + """<body>
{body}
  <script src="/js/app.js"></script>
{scripts}</body>
</html>
"""
for f in sorted(SRC.glob("*.html")):
    text = f.read_text()
    meta, body = text.split("\n---\n", 1)
    opts = dict(line.split(":", 1) for line in meta.strip().splitlines())
    opts = {k.strip(): v.strip() for k, v in opts.items()}
    scripts = "".join(f'  <script src="{s.strip()}"></script>\n' for s in opts.get("scripts", "").split(",") if s.strip())
    tpl = PLAIN if opts.get("layout") == "plain" else APP
    body = "\n".join(("        " + l) if l.strip() and tpl is APP else l for l in body.rstrip().splitlines())
    css = "".join(f'\n  <link rel="stylesheet" href="{c.strip()}">' for c in opts.get("css", "").split(",") if c.strip())
    (OUT / f.name).write_text(tpl.format(title=opts["title"], body=body, scripts=scripts, css=css))
    print("ok", f.name)
