# -*- coding: utf-8 -*-
lines = open('index.html', encoding='utf-8').read().split('\n')

# 1-based line numbers from inspection:
# <style> at 20, </style> at 226
# script1: 252-255, script2: 326-351, script3: 352-367
def L(a, b):  # inclusive, 1-based
    return lines[a-1:b]

# --- CSS: lines 21..225 (inside <style>), dedent 2 spaces ---
css_lines = L(21, 225)
css = '\n'.join(l[2:] if l.startswith('  ') else l for l in css_lines)

# --- JS: combine three inline scripts ---
def body(a, b):  # strip the <script>/</script> wrapper lines, dedent
    inner = L(a+1, b-1)
    return '\n'.join(l[4:] if l.startswith('    ') else l for l in inner)

s1 = body(252, 255)
s2 = body(326, 351)
s3 = body(352, 367)
js = '// 手機阻擋\n' + s1 + '\n\n// Loader\n' + s2 + '\n\n// 作者資訊 Modal\n' + s3 + '\n'

open('index.css', 'w', encoding='utf-8', newline='\n').write(css.strip('\n') + '\n')
open('index.js', 'w', encoding='utf-8', newline='\n').write(js)

# --- rebuild HTML ---
out = []
out += L(1, 19)                       # head start
out.append('<link rel="stylesheet" href="index.css">')
out += L(227, 251)                    # </head><body> ... up to before script1
# skip script1 (252-255)
out += L(256, 325)                    # blank + hero + tools + modal, up to before script2
# skip script2 (326-351) and script3 (352-367)
out.append('  <script src="index.js"></script>')
out += L(368, 370)                    # blank, </body>, </html>

open('index.html', 'w', encoding='utf-8', newline='\n').write('\n'.join(out) + '\n')
print('done css=%d js=%d' % (len(css), len(js)))
