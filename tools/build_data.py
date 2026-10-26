"""Собирает data/src/<lang>/<тема>.json (+ import_*.json) в компактные data/<lang>.json для сайта.

id слова = первые 10 символов sha1("<lang>:<word>:<pos>") — по нему же называются mp3,
поэтому прогресс и озвучка не сбиваются при пересборке.
Дубли (то же слово и та же часть речи) остаются только в первой по порядку теме.

    python tools/build_data.py
"""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATS = [
    ("basics", "Основа", "🧩"),
    ("numbers", "Числа и вопросы", "🔢"),
    ("time", "Время и календарь", "⏰"),
    ("verbs_core", "Главные глаголы", "⚡"),
    ("verbs_action", "Действия и движение", "🏃"),
    ("verbs_mind", "Мысли, речь, чувства", "💭"),
    ("adjectives", "Прилагательные", "🎨"),
    ("adverbs", "Наречия и связки", "🔗"),
    ("abstract", "Абстрактные понятия", "🧠"),
    ("feelings", "Эмоции и характер", "❤️"),
    ("people", "Люди и семья", "👨‍👩‍👧"),
    ("body", "Тело и здоровье", "🫀"),
    ("food", "Еда и напитки", "🍎"),
    ("home", "Дом и вещи", "🏠"),
    ("clothes", "Одежда, покупки, цвета", "👕"),
    ("nature", "Природа и животные", "🌿"),
    ("city", "Город и транспорт", "🏙️"),
    ("travel", "Путешествия и хобби", "✈️"),
    ("work", "Работа и деньги", "💼"),
    ("study", "Учёба и наука", "📚"),
    ("society", "Общество и закон", "⚖️"),
    ("tech", "Технологии и медиа", "💻"),
]
# Русский: редкие слова из книг — один файл data/src/ru/words.json с полем cat
CATS_BY_LANG = {
    "ru": [
        ("clothes", "Одежда, ткани, причёски", ""), ("home", "Быт и вещи", ""), ("sea", "Море и корабли", ""),
        ("history", "История, чины, общество", ""), ("church", "Церковь и религия", ""), ("character", "Характер и поведение", ""),
        ("people", "Люди и занятия", ""), ("speech", "Книжные слова и термины", ""), ("nature", "Природа и местность", ""),
        ("road", "Лошади, повозки, дорога", ""), ("old", "Устаревшие и просторечные", ""),
    ],
}
POS = {"n", "v", "adj", "adv", "prep", "pron", "conj", "det", "num", "int", "phr"}
LEVELS = {"A1", "A2", "B1", "B2"}


def word_id(lang, w, pos):
    return hashlib.sha1(f"{lang}:{w}:{pos}".encode("utf-8")).hexdigest()[:10]


def build(lang):
    src = ROOT / "data" / "src" / lang
    seen, words, cats, problems = set(), [], [], []
    # import_*.json — добавочные слова с полем cat (например, со старого сайта); идут в конец своей темы
    extra = {}
    for f in sorted(src.glob("import_*.json")):
        for e in json.loads(f.read_text(encoding="utf-8")):
            extra.setdefault(e.get("cat"), []).append(e)
    unknown = set(extra) - {c[0] for c in CATS_BY_LANG.get(lang, CATS)}
    if unknown:
        problems.append(f"import: неизвестные темы {unknown}")
    single = src / "words.json"
    if single.exists():
        for e in json.loads(single.read_text(encoding="utf-8")):
            extra.setdefault(e.get("cat"), []).append(e)
    for cat, name, emoji in CATS_BY_LANG.get(lang, CATS):
        f = src / f"{cat}.json"
        if not f.exists() and not single.exists():
            problems.append(f"нет файла {f.name}")
            continue
        items = (json.loads(f.read_text(encoding="utf-8")) if f.exists() else []) + extra.get(cat, [])
        kept = 0
        for e in items:
            w = str(e.get("w", "")).strip()
            pos = str(e.get("pos", "")).strip()
            t = str(e.get("t", "")).strip()
            if not w or not t:
                problems.append(f"{cat}: пустое слово/перевод {e}")
                continue
            if pos not in POS:
                problems.append(f"{cat}: {w}: pos={pos!r}")
            lvl = e.get("lvl") if e.get("lvl") in LEVELS else "B1"
            if lang == "es" and lvl == "B2":  # испанский список — до B1, редкие B2 вливаются в B1
                lvl = "B1"
            key = (w.lower(), pos)
            if key in seen:
                continue
            seen.add(key)
            words.append([word_id(lang, w, pos), w, e.get("ipa", "") or "", pos, t, lvl, cat,
                          str(e.get("ex", "")).strip(), str(e.get("exr", "")).strip()])
            kept += 1
        if kept:
            cats.append([cat, name, emoji])
    ids = [w[0] for w in words]
    assert len(ids) == len(set(ids)), "коллизия id"
    out = ROOT / "data" / f"{lang}.json"
    out.write_text(json.dumps({"cats": cats, "words": words}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    by_lvl = {}
    for w in words:
        by_lvl[w[5]] = by_lvl.get(w[5], 0) + 1
    print(f"{lang}: {len(words)} слов, {len(cats)} тем, уровни {dict(sorted(by_lvl.items()))}, {out.stat().st_size // 1024} КБ")
    for p in problems[:30]:
        print("  !", p)
    return words


def build_verbs(lang):
    """data/src/<lang>/verbs.json: [инфинитив, 2-я форма, 3-я форма, перевод, 1|2] → data/verbs-<lang>.json"""
    src = ROOT / "data" / "src" / lang / "verbs.json"
    if not src.exists():
        return
    seen, out = set(), []
    for v1, v2, v3, t, tier in json.loads(src.read_text(encoding="utf-8")):
        if v1 in seen:
            continue
        seen.add(v1)
        out.append([hashlib.sha1(f"{lang}:verb:{v1}".encode("utf-8")).hexdigest()[:10], v1, v2, v3, t, tier])
    (ROOT / "data" / f"verbs-{lang}.json").write_text(json.dumps({"verbs": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{lang}: {len(out)} глаголов с тремя формами")


PHRASE_CATS = [
    ("greetings", "Приветствия и прощания"), ("smalltalk", "Как дела и разговор"), ("intro", "Знакомство"),
    ("polite", "Вежливость"), ("requests", "Просьбы и вопросы"), ("opinion", "Мнение и согласие"),
    ("reactions", "Эмоции и реакции"), ("plans", "Время и планы"), ("cafe", "В кафе и ресторане"),
    ("shopping", "Покупки"), ("travel", "Дорога и отель"), ("help", "Проблемы и помощь"),
    ("phone", "Телефон и сообщения"), ("work", "Работа и учёба"), ("everyday", "Разговорные выражения"),
    ("idioms", "Идиомы"),
]


def build_phrases(lang):
    """data/src/<lang>/phrases.json (формат в data/PHRASES_SPEC.md) → data/phrases-<lang>.json"""
    src = ROOT / "data" / "src" / lang / "phrases.json"
    if not src.exists():
        return
    order = {c: i for i, (c, _) in enumerate(PHRASE_CATS)}
    seen, items = set(), []
    for e in json.loads(src.read_text(encoding="utf-8")):
        p, t, cat = str(e.get("p", "")).strip(), str(e.get("t", "")).strip(), e.get("cat")
        if not p or not t or cat not in order or p.lower() in seen:
            continue
        seen.add(p.lower())
        lvl = e.get("lvl") if e.get("lvl") in LEVELS else "A2"
        items.append([hashlib.sha1(f"{lang}:phrase:{p}".encode("utf-8")).hexdigest()[:10], p, t, str(e.get("note", "")).strip(), cat, lvl])
    items.sort(key=lambda x: order[x[4]])
    cats = [[c, n] for c, n in PHRASE_CATS if any(x[4] == c for x in items)]
    (ROOT / "data" / f"phrases-{lang}.json").write_text(json.dumps({"cats": cats, "items": items}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{lang}: {len(items)} фраз в {len(cats)} темах")


def build_theory(lang):
    """data/theory/<lang>/NN-slug.md → data/theory-<lang>.json: [{id, title, sub, md}]"""
    src = ROOT / "data" / "theory" / lang
    topics = []
    for f in sorted(src.glob("*.md")) if src.exists() else []:
        lines = f.read_text(encoding="utf-8").strip().splitlines()
        title = lines[0].lstrip("# ").strip() if lines and lines[0].startswith("#") else f.stem
        rest = lines[1:] if lines and lines[0].startswith("#") else lines
        sub = ""
        if rest and rest[0].startswith(">"):
            sub, rest = rest[0].lstrip("> ").strip(), rest[1:]
        topics.append({"id": f.stem, "title": title, "sub": sub, "md": "\n".join(rest).strip()})
    out = ROOT / "data" / f"theory-{lang}.json"
    if topics:
        out.write_text(json.dumps(topics, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{lang}: теория — {len(topics)} тем")


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["en", "es", "ru"]:
        if (ROOT / "data" / "src" / lang).exists():
            build(lang)
            build_verbs(lang)
            build_phrases(lang)
        build_theory(lang)
