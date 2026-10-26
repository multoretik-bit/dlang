"""notion/blocks.json → data/theory/en/NN.md (тема = заголовок 3-го уровня, раздел = @group)."""
import json
import re
import sys
from pathlib import Path

B = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = Path(sys.argv[2])
ROOT_ID = '24a8171a-481c-8006-a863-f5ed3934c410'


def rich(rt):
    out = []
    for seg in rt or []:
        text = seg[0]
        marks = seg[1] if len(seg) > 1 else []
        if not text.strip():
            out.append(text)
            continue
        lead = text[:len(text) - len(text.lstrip())]
        trail = text[len(text.rstrip()):]
        core = text.strip()
        kinds = {m[0] for m in marks}
        if 'c' in kinds:
            core = f'`{core}`'
        if 'b' in kinds:
            core = f'**{core}**'
        if 'i' in kinds:
            core = f'*{core}*'
        out.append(lead + core + trail)
    return ''.join(out).replace('\n', ' ')


def title(b):
    return rich(b.get('properties', {}).get('title'))


def strip_emoji(s):
    return re.sub(r'^[^\wА-Яа-яЁё]+', '', s).strip()


def table(b):
    fmt = b.get('format', {})
    cols = fmt.get('table_block_column_order') or []
    rows = []
    for rid in b.get('content') or []:
        r = B.get(rid)
        if not r:
            continue
        props = r.get('properties', {})
        if not cols:
            cols = list(props.keys())
        rows.append([rich(props.get(c)).replace('|', '/') or ' ' for c in cols])
    if not rows:
        return []
    lines = ['| ' + ' | '.join(rows[0]) + ' |', '| ' + ' | '.join('---' for _ in rows[0]) + ' |']
    lines += ['| ' + ' | '.join(r) + ' |' for r in rows[1:]]
    return lines + ['']


def render(ids, depth=0):
    lines = []
    for i in ids:
        b = B.get(i)
        if not b:
            continue
        t, txt, kids = b['type'], title(b), b.get('content') or []
        if t == 'text':
            if txt.strip():
                lines += [txt, '']
        elif t in ('bulleted_list', 'to_do', 'numbered_list'):
            mark = '1.' if t == 'numbered_list' else '-'
            prefix = '— ' if depth else ''
            if txt.strip():
                lines.append(f'{mark} {prefix}{txt}')
            # вложенные пункты — плоско, с тире (рендерер без вложенных списков)
            for c in kids:
                cb = B.get(c)
                if cb and title(cb).strip():
                    lines.append(f'- — {title(cb)}')
            nxt = None
            lines.append('') if False else None
        elif t == 'toggle':
            # раскрывающийся блок (в Notion — «Проверить себя» с ответом)
            lines += ['', f'+++ {strip_emoji(txt)}'] + render(kids, depth + 1) + ['+++', '']
        elif t in ('sub_header', 'sub_sub_header', 'header'):
            lines += ['', f'## {strip_emoji(txt)}', '']
            lines += render(kids, depth + 1)
        elif t == 'callout':
            lines += [f'> 💡 {txt}', '']
            lines += render(kids, depth + 1)
        elif t == 'quote':
            lines += [f'> {txt}', '']
        elif t == 'table':
            lines += [''] + table(b)
        elif t == 'divider':
            lines.append('')
        else:
            if txt.strip():
                lines += [txt, '']
        # пустая строка после блока списков
        if t not in ('bulleted_list', 'to_do', 'numbered_list') and lines and lines[-1] != '':
            lines.append('')
    # отделить списки от следующего текста
    fixed = []
    for k, ln in enumerate(lines):
        if ln is None:
            continue
        fixed.append(ln)
        is_item = re.match(r'^(-|1\.) ', ln or '')
        nxt = next((x for x in lines[k + 1:] if x is not None), '')
        if is_item and nxt and not re.match(r'^(-|1\.) ', nxt):
            fixed.append('')
    return fixed


OUT.mkdir(parents=True, exist_ok=True)
for f in OUT.glob('*.md'):
    f.unlink()
n = 0
for sid in B[ROOT_ID].get('content') or []:
    sec = B.get(sid)
    if not sec or sec['type'] != 'sub_header':
        continue
    group = strip_emoji(title(sec))
    for tid in sec.get('content') or []:
        tb = B.get(tid)
        if not tb:
            continue
        n += 1
        name = re.sub(r'^\d+\.\s*', '', title(tb)).strip()
        body = render(tb.get('content') or [])
        md = '\n'.join([f'# {name}', f'@group {group}', ''] + body)
        md = re.sub(r'\n{3,}', '\n\n', md).strip() + '\n'
        (OUT / f'{n:02d}.md').write_text(md, encoding='utf-8')
print('topics', n)
