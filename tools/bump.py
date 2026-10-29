#!/usr/bin/env python3
"""Set the build tag everywhere, and bust the browser cache with it.

GitHub Pages serves index.html with a short cache and src/*.js and the
stylesheet with a long one. So a pushed fix could be live in the HTML
and still be running yesterday's JavaScript in somebody's browser —
which looks exactly like the fix not working, and cost a whole evening
once already. Every asset is therefore requested as `?v=<build>`, and
the build tag changes on every push.

    python3 tools/bump.py            # today's date, next number
    python3 tools/bump.py b-30oct-3  # or say it outright
"""
import re, sys, pathlib, datetime

root = pathlib.Path(__file__).resolve().parent.parent
html = root / 'index.html'
gs   = root / 'backend.gs'

cur = re.search(r'id="buildTag"[^>]*>([^<]+)<', html.read_text(encoding='utf-8')).group(1).strip()

if len(sys.argv) > 1:
    new = sys.argv[1]
else:
    today = datetime.date.today().strftime('b-%-d%b').lower()
    m = re.match(r'^(b-\d+[a-z]+)-(\d+)$', cur)
    new = f'{cur.rsplit("-",1)[0]}-{int(m.group(2))+1}' if m and m.group(1) == today else f'{today}-1'

s = html.read_text(encoding='utf-8')
s = s.replace(f'>{cur}<', f'>{new}<')
# every local asset carries the build, so none of them can be stale
s = re.sub(r'(href|src)="(src/[^"?]+)(\?v=[^"]*)?"', rf'\1="\2?v={new}"', s)
html.write_text(s, encoding='utf-8')

g = gs.read_text(encoding='utf-8')
g = g.replace(f"BACKEND_BUILD = '{cur}'", f"BACKEND_BUILD = '{new}'")
gs.write_text(g, encoding='utf-8')

n = len(re.findall(r'\?v=' + re.escape(new), s))
print(f'{cur} -> {new}   ({n} assets busted)')
