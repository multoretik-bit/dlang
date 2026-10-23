# dLang phrase data spec

Learner: native Russian speaker who wants to know how people REALLY say things. Output file:
`data/src/<lang>/phrases.json` — one JSON array (UTF-8, valid JSON, no comments):

```json
{"p": "How's it going?", "t": "Как дела? Как жизнь?", "note": "Разговорный вариант How are you?, между друзьями.", "cat": "smalltalk", "lvl": "A1"}
```

- `p` — the phrase exactly as natives say/write it, with normal capitalization and punctuation. Natural, current,
  neutral-to-casual register unless the category says otherwise. 2–9 words is ideal; never more than 12.
  Spanish: Spain/neutral Spanish, correct accents, ¿…? and ¡…!.
- `t` — natural Russian equivalent (how a Russian would say the same thing), not a word-by-word gloss. Max ~50 chars.
- `note` — optional (may be ""), max ~90 chars, Russian: when/with whom it's used, register (формально/разговорно),
  or the literal meaning for idioms. Useful, not obvious.
- `cat` — one category id from the list below.
- `lvl` — A1, A2, B1 or B2.

Rules: the most common, genuinely useful expressions first; no duplicates or near-duplicates (don't list both
"Thank you" and "Thanks" as separate entries unless the note explains a real difference); no offensive phrases;
no rare/old-fashioned idioms. Each phrase must stand on its own (no placeholders like "[name]" — use a concrete
natural example instead, e.g. "My name is Anna.").

Categories (id — Russian name) and how many phrases per category (~15 each):
greetings — Приветствия и прощания
smalltalk — Как дела и разговор ни о чём
intro — Знакомство
polite — Вежливость: спасибо, извините, пожалуйста
requests — Просьбы и вопросы
opinion — Мнение, согласие, несогласие
reactions — Эмоции и реакции
plans — Время, встречи и планы
cafe — В кафе и ресторане
shopping — Покупки
travel — Дорога, транспорт, отель
help — Проблемы, помощь, здоровье
phone — Телефон и сообщения
work — Работа и учёба
everyday — Разговорные выражения
idioms — Идиомы и крылатые выражения
