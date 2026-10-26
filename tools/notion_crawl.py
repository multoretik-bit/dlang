"""Обходит опубликованную страницу Notion и сохраняет все блоки в notion/blocks.json."""
import json
import sys
import time
import urllib.request

ROOT_ID = '24a8171a-481c-8006-a863-f5ed3934c410'
API = 'https://www.notion.so/api/v3/'
out_path = sys.argv[1]


def post(endpoint, payload):
    req = urllib.request.Request(API + endpoint, data=json.dumps(payload).encode(), headers={'content-type': 'application/json', 'user-agent': 'Mozilla/5.0'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read().decode('utf-8'))
        except Exception as e:
            print('retry', endpoint, e)
            time.sleep(5 + attempt * 10)
    raise RuntimeError(endpoint)


def unwrap(v):
    v = v.get('value', v)
    return v.get('value', v) if isinstance(v, dict) and 'value' in v and isinstance(v['value'], dict) else v


blocks = {}


def fetch(ids):
    ids = [i for i in ids if i not in blocks]
    for k in range(0, len(ids), 80):
        part = ids[k:k + 80]
        res = post('syncRecordValuesMain', {'requests': [{'pointer': {'table': 'block', 'id': i}, 'version': -1} for i in part]})
        for i, rec in res.get('recordMap', {}).get('block', {}).items():
            v = unwrap(rec)
            if v and v.get('type'):
                blocks[i] = v
        time.sleep(1.0)


def page_chunks(pid):
    cursor, n = {'stack': []}, 0
    while True:
        res = post('loadPageChunk', {'pageId': pid, 'limit': 100, 'cursor': cursor, 'chunkNumber': n, 'verticalColumns': False})
        for i, rec in res.get('recordMap', {}).get('block', {}).items():
            v = unwrap(rec)
            if v and v.get('type'):
                blocks.setdefault(i, v)
        cursor = res.get('cursor', {'stack': []})
        n += 1
        if not cursor.get('stack'):
            break


queue = [ROOT_ID]
seen_pages = set()
while queue:
    bid = queue.pop(0)
    if bid not in blocks:
        fetch([bid])
    b = blocks.get(bid)
    if not b:
        print('no access', bid)
        continue
    if b['type'] == 'page' and bid not in seen_pages:
        seen_pages.add(bid)
        page_chunks(bid)
    kids = b.get('content') or []
    fetch(kids)
    queue.extend(kids)

json.dump(blocks, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)
print('blocks', len(blocks), 'pages', len(seen_pages))
