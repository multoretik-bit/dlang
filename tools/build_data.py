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
    unknown = set(extra) - {c[0] for c in CATS}
    if unknown:
        problems.append(f"import: неизвестные темы {unknown}")
    for cat, name, emoji in CATS:
        f = src / f"{cat}.json"
        if not f.exists():
            problems.append(f"нет файла {f.name}")
            continue
        items = json.loads(f.read_text(encoding="utf-8")) + extra.get(cat, [])
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


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["en", "es"]:
        build(lang)
        build_verbs(lang)
