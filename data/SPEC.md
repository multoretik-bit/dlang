# dLang word data spec

Learner: native Russian speaker. Each category = one file `data/src/<lang>/<cat>.json`,
a JSON array of entries (UTF-8, no comments, no trailing commas):

```json
{"w": "decide", "ipa": "/dɪˈsaɪd/", "pos": "v", "t": "решать, принимать решение", "lvl": "A2",
 "ex": "We decided to stay home.", "exr": "Мы решили остаться дома."}
```

- `w` — the word in its dictionary form. English: lowercase unless a proper noun/"I". Spanish nouns WITH article
  (`el perro`, `la casa`, `el agua`); adjectives in masculine singular (`bueno`); verbs in infinitive.
  Short fixed phrases are allowed only where natural (`of course`, `a lot`, `por favor`), keep them rare.
- `ipa` — English: British/General IPA in slashes. Spanish: empty string "".
- `pos` — one of: n, v, adj, adv, prep, pron, conj, det, num, int, phr.
- `t` — Russian translation: the 1–3 most common meanings, most frequent first, comma-separated, max ~40 chars.
  Accurate, natural Russian (as in a good dictionary). For verbs use infinitive (`решать`). No explanations in brackets
  unless the word is truly ambiguous (then a short hint like `(о времени)`).
- `lvl` — CEFR level of the word: A1, A2, B1 or B2 (Oxford 3000/5000 style judgement).
- `ex` — one short natural example sentence (4–10 words) using the word in the meaning of `t`, simple grammar.
- `exr` — natural Russian translation of `ex`.

Selection: the MOST frequent and useful words for that topic (think Oxford 3000 / NGSL core vocabulary for English,
top frequency lists for Spanish). Prefer high-frequency everyday words over rare topical ones. No duplicates within a
file; a word should go to its most natural category. No offensive words.

Categories (id — Russian name):
basics — Основа (местоимения, артикли, предлоги, союзы, определители, вспомогательные)
numbers — Числа и вопросы
time — Время и календарь
verbs_core — Главные глаголы
verbs_action — Действия и движение
verbs_mind — Мысли, речь, чувства (глаголы)
adjectives — Прилагательные
adverbs — Наречия и связки
abstract — Абстрактные понятия (idea, reason, way, problem…)
feelings — Эмоции и характер
people — Люди и семья
body — Тело и здоровье
food — Еда и напитки
home — Дом и вещи
clothes — Одежда, покупки, цвета
nature — Природа, животные, погода
city — Город и транспорт
travel — Путешествия, спорт, хобби
work — Работа и деньги
study — Учёба и наука
society — Общество и закон
tech — Технологии и медиа
