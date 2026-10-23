# dLang

Учим слова карточками каждый день: 1945 главных английских и 1070 испанских слов по темам,
квизы, интервальные повторения, свои слова и ассоциации, озвучка нейроголосами.

- `index.html`, `app.js`, `app.css` — весь сайт, без сборки. Прогресс — в localStorage (`dlang:v1`).
- `data/src/<lang>/<тема>.json` — исходные словари (формат в `data/SPEC.md`).
- `python tools/build_data.py` — собрать `data/en.json`, `data/es.json`.
- `python tools/make_audio.py` — озвучить новые слова (edge-tts, голоса Ava / Elvira), готовые файлы пропускаются.
- Публикация: GitHub Pages из ветки `main` (после правок `app.js`/`app.css` поднять `?v=` в index.html и VERSION в sw.js).
