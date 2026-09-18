import csv
import json
import sys

source, target = sys.argv[1], sys.argv[2]
rows = []
with open(source, encoding='utf-8', newline='') as handle:
    for row in csv.DictReader(handle):
        word = (row.get('word') or '').strip()
        translation = (row.get('translation') or '').strip()
        if not word.isascii() or not word.replace('-', '').replace("'", '').isalpha() or not translation:
            continue
        bnc = int(row.get('bnc') or 0)
        frq = int(row.get('frq') or 0)
        if not bnc and not frq:
            continue
        rank = min(value for value in (bnc, frq) if value > 0)
        rows.append((rank, word.lower(), {
            'word': word,
            'phonetic': (row.get('phonetic') or '').strip(),
            'translation': translation,
            'pos': (row.get('pos') or '').strip(),
            'exchange': (row.get('exchange') or '').strip(),
        }))

rows.sort(key=lambda item: (item[0], item[1]))
dictionary = {}
for _, key, value in rows:
    if key not in dictionary:
        dictionary[key] = value
    if len(dictionary) >= 20000:
        break

with open(target, 'w', encoding='utf-8') as handle:
    json.dump(dictionary, handle, ensure_ascii=False, separators=(',', ':'))

print(f'wrote {len(dictionary)} entries')
