# dLang

Учим слова карточками каждый день: 2351 английское слово (главные + слова со старого сайта) и 1070 испанских слов по темам,
квизы, интервальные повторения, свои слова и ассоциации, озвучка нейроголосами.

- `index.html`, `app.js`, `app.css` — весь сайт, без сборки. Прогресс — в localStorage (`dlang:v1`).
- `data/src/<lang>/<тема>.json` — исходные словари (формат в `data/SPEC.md`); `verbs.json` — три формы неправильных глаголов; `phrases.json` — устойчивые выражения (формат в `data/PHRASES_SPEC.md`).
- `python tools/build_data.py` — собрать `data/en.json`, `data/es.json`.
- `python tools/make_audio.py` — озвучить новые слова (edge-tts, голоса Ava / Elvira), готовые файлы пропускаются.
- Публикация: GitHub Pages из ветки `main` (после правок `app.js`/`app.css` поднять `?v=` в index.html и VERSION в sw.js).
- Теория: `data/theory/<lang>/NN-*.md` (`# заголовок`, `@group раздел`, `> подзаголовок`, мини-Markdown, `+++ Заголовок … +++` — раскрывающийся блок) → `python tools/build_data.py`.
- Английская теория — из опубликованной страницы Notion пользователя: `python tools/notion_crawl.py blocks.json` → `python tools/notion_to_md.py blocks.json data/theory/en` → `python tools/build_data.py en`.
