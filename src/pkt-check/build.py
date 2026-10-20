#!/usr/bin/env python3
"""回ごとの pkt セルフチェックページを dist/ に作る。
使い方: python3 build.py [出力先]   （analyze.js の SPECS にある回をすべて作る）"""
import re, sys, os, pathlib
here = pathlib.Path(__file__).parent
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else here / 'dist')
head = (here / 'ui_head.html').read_text()
body = (here / 'ui_body.html').read_text()
js = ''.join((here / f).read_text() for f in ['md5crypt.js', 'pktcore.js', 'analyze.js', 'ui.js'])
js = '\n'.join(l for l in js.splitlines() if not l.startswith('if (typeof module'))
specs = re.findall(r"^  '(\d+)': \{\n    label: '([^']+)'", (here / 'analyze.js').read_text(), re.M)
head = re.sub(r'<title>.*?</title>\n<meta name="claude:viewport-fit-sides"[^>]*>\n', '', head)
pages = []
for key, label in specs:
    n = int(key); title = f'第{n}回 pkt セルフチェック'
    html = ('<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'<title>{title}</title>\n<meta name="robots" content="noindex">\n' + head +
            '<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n' +
            body.replace('__H1__', title) +
            f'<script>window.PKT_LESSON = {key!r};</script>\n<script>\n{js}\n</script>\n</body>\n</html>\n')
    d = out / 'pkt-check' / f'{n:02d}'; d.mkdir(parents=True, exist_ok=True)
    (d / 'index.html').write_text(html); pages.append((n, label))
items = '\n'.join(f'<li><a href="pkt-check/{n:02d}/">第{n}回 pkt セルフチェック</a>（{l.split(" ", 1)[1]}）</li>' for n, l in pages)
(out / 'index.html').write_text(f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>情報通信ネットワークⅡ 提出前の確認</title>
<style>body{{margin:0;background:#f7f5f0;color:#1f2430;font:16px/1.75 "BIZ UDPGothic","Hiragino Sans","Yu Gothic",sans-serif}}main{{max-width:40em;margin:0 auto;padding:24px max(16px,env(safe-area-inset-left))}}h1{{font-size:24px;color:#1e3a5f}}a{{color:#1e3a5f}}</style></head>
<body><main><h1>情報通信ネットワークⅡ 提出前の確認</h1><p>manaba に貼られたリンクから、その回のページを開いてください。</p><ul>
{items}
</ul></main></body></html>
''')
(out / '.nojekyll').write_text('')
print('built', [p[0] for p in pages], '->', out)
