// dLang — учим слова каждый день: путь из уроков, квизы, карточки, повторения.
// Состояние — localStorage (dlang:v1), словари — data/<lang>.json,
// озвучка — audio/<lang>/<id>.mp3 (слово) и <id>x.mp3 (пример).

const FLAG_EN = '<svg class="flag" viewBox="0 0 60 42"><clipPath id="fuk"><rect width="60" height="42" rx="8"/></clipPath><g clip-path="url(#fuk)"><rect width="60" height="42" fill="#012169"/><path d="M0 0l60 42M60 0 0 42" stroke="#fff" stroke-width="9"/><path d="M0 0l60 42M60 0 0 42" stroke="#C8102E" stroke-width="3"/><path d="M30 0v42M0 21h60" stroke="#fff" stroke-width="13"/><path d="M30 0v42M0 21h60" stroke="#C8102E" stroke-width="7"/></g></svg>';
const FLAG_ES = '<svg class="flag" viewBox="0 0 60 42"><clipPath id="fes"><rect width="60" height="42" rx="8"/></clipPath><g clip-path="url(#fes)"><rect width="60" height="42" fill="#AA151B"/><rect y="10.5" width="60" height="21" fill="#F1BF00"/></g></svg>';
const LANGS = {
  en: { name: 'Английский', in: 'на английском', flag: FLAG_EN, speech: 'en-US', levels: ['A1', 'A2', 'B1', 'B2'], total: '2351 слово', tip: 'decide — «дай сайд»: выбери сторону' },
  es: { name: 'Испанский', in: 'на испанском', flag: FLAG_ES, speech: 'es-ES', levels: ['A1', 'A2', 'B1'], total: '1070 слов', tip: 'la playa — «плайя»: пляж, где плавают' },
};
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const LEVEL_INFO = {
  A1: ['Новичок', 'Я только начинаю'],
  A2: ['Базовый', 'Знаю простые слова и фразы'],
  B1: ['Средний', 'Могу поговорить на бытовые темы'],
  B2: ['Продвинутый', 'Хочу добрать сложную лексику'],
};
const GOALS = [[5, 'Легко'], [10, 'Нормально'], [15, 'Серьёзно'], [20, 'Интенсивно'], [30, 'Марафон']];
const INTERVALS = [0, 1, 2, 4, 8, 16, 35, 90]; // дни до повторения на каждой ступени
const LEARNED = 4;                              // с этой ступени слово «изучено»
const LESSON_SIZE = 6;                          // новых слов в одном уроке
const UNIT_COLORS = ['green', 'purple', 'blue', 'orange', 'pink', 'teal'];
const MINE = { id: 'mine', name: 'Мои слова' };
const OLD = { id: 'old', name: 'Со старого сайта' };
const OLD_SITE = 'https://den-english-10000.tivishka.chatgpt.site/';

// ---------- утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 6e4) / 864e5); };
const dayKey = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a) => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const jitter = (d) => (d <= 2 ? d : d + Math.round((Math.random() - 0.5) * d * 0.2));
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const words = (n) => `${n} ${plural(n, 'слово', 'слова', 'слов')}`;
const days = (n) => `${n} ${plural(n, 'день', 'дня', 'дней')}`;

// ---------- состояние ----------
const KEY = 'dlang:v1';
let S = load();

function blank() {
  return { v: 1, lang: null, langs: {}, streak: { count: 0, last: -1, best: 0 }, xp: {}, day: {}, settings: { autoplay: true, sound: true, slow: false } };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) return { ...blank(), ...s, settings: { ...blank().settings, ...s.settings } };
  } catch {}
  return blank();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
function LP(lang = S.lang) {
  return (S.langs[lang] ||= { level: null, daily: 10, words: {}, custom: [] });
}
function rec(id, create) {
  const all = LP().words;
  if (!all[id] && create) all[id] = { s: 0, due: 0 };
  return all[id];
}
function dayStat(t = today()) { return (S.day[dayKey(t)] ||= { n: 0, r: 0 }); }

// ---------- словари ----------
const DB = {};
const D = () => DB[S.lang];

async function loadLang(lang) {
  if (DB[lang]) return DB[lang];
  const res = await fetch(`data/${lang}.json?v=3`);
  if (!res.ok) throw new Error(`data/${lang}.json: ${res.status}`);
  const data = await res.json();
  DB[lang] = {
    cats: data.cats.map(([id, name]) => ({ id, name })),
    base: data.words.map(([id, w, ipa, pos, t, lvl, cat, ex, exr]) => ({ id, w, ipa, pos, t, lvl, cat, ex, exr, audio: true })),
  };
  indexLang(lang);
  await applyBundledImport(lang);
  return DB[lang];
}
function indexLang(lang = S.lang) {
  const db = DB[lang];
  if (!db) return;
  const custom = (LP(lang).custom || []).map((c) => ({ ...c, custom: true, audio: false, cat: c.cat || 'mine', lvl: c.lvl || '' }));
  db.words = [...custom, ...db.base];
  db.byId = new Map(db.words.map((w) => [w.id, w]));
  db.catMap = new Map([...db.cats, MINE, OLD].map((c) => [c.id, c]));
  db.path = null;
}
const W = (id) => D()?.byId.get(id);
const catName = (w) => (D().catMap.get(w.cat) || MINE).name;

function status(id) {
  const r = LP().words[id];
  if (!r || !r.s) return 'new';
  return r.s >= LEARNED ? 'learned' : 'learning';
}
const STATUS_NAME = { new: 'Новое', learning: 'Изучаю', learned: 'Изучено' };
function counts(list = D().words) {
  const c = { new: 0, learning: 0, learned: 0, total: list.length };
  for (const w of list) c[status(w.id)]++;
  return c;
}

// ---------- уровни сложности ----------
const LEVEL_NAME = { A1: 'Лёгкие', A2: 'Средние', B1: 'Сложные', B2: 'Очень сложные' };
const LEVEL_COLOR = { A1: 'green', A2: 'blue', B1: 'purple', B2: 'orange' };
const levelWords = (lv) => (lv === 'mine' ? D().words.filter((w) => w.custom && w.cat !== 'old') : D().base.filter((w) => w.lvl === lv));
const freshOf = (list) => list.filter((w) => status(w.id) === 'new').map((w) => w.id);
// уровень для главной кнопки: свой, а если в нём всё выучено — следующие по кругу
function mainLevel() {
  const lv = LANGS[S.lang].levels, start = Math.max(0, lv.indexOf(LP().level));
  return [...lv.slice(start), ...lv.slice(0, start)].find((l) => freshOf(levelWords(l)).length) || null;
}
// урок из случайных новых слов списка; если новых нет — прогон уже выученных
function learnFrom(list) {
  const fresh = shuffle(freshOf(list)).slice(0, LESSON_SIZE);
  if (fresh.length) return startLesson({ newIds: fresh, reviewIds: shuffle(dueIds()).slice(0, 4) });
  if (!list.length) return toast('Здесь пока нет слов');
  toast('Новых слов здесь не осталось — повторим выученные');
  startLesson({ reviewIds: shuffle(list.map((w) => w.id)).slice(0, 15), practice: true });
}
function learnMain() {
  const mine = levelWords('mine');
  if (freshOf(mine).length) return learnFrom(mine); // свои слова — в первую очередь
  const lv = mainLevel();
  if (lv) learnFrom(levelWords(lv));
  else toast('Все слова выучены!');
}
function dueIds() {
  const t = today(), all = LP().words, out = [];
  for (const id in all) if (all[id].s >= 1 && all[id].due <= t && W(id)) out.push(id);
  return out.sort((a, b) => all[a].due - all[b].due);
}

// ---------- интервальные повторения ----------
function introduce(id) {
  const r = rec(id, true);
  if (!r.s) { r.s = 1; r.due = today() + 1; r.first = today(); dayStat().n++; }
}
function grade(id, ok) {
  const r = rec(id, true), t = today();
  r.n = (r.n || 0) + 1;
  if (!r.s) { if (ok) introduce(id); return; }
  dayStat().r++;
  if (ok) {
    r.ok = (r.ok || 0) + 1;
    if (r.due <= t) { r.s = Math.min(INTERVALS.length - 1, r.s + 1); r.due = t + jitter(INTERVALS[r.s]); }
  } else {
    r.bad = (r.bad || 0) + 1;
    r.s = Math.max(1, r.s - 2);
    r.due = t + 1;
  }
  if (r.s >= LEARNED && !r.la) r.la = t;
}
function markKnown(id) {
  const r = rec(id, true);
  r.s = 6; r.due = today() + jitter(INTERVALS[6]); r.k = 1; r.la ||= today();
}
function resetWord(id) {
  const r = rec(id);
  if (r) { r.s = 0; r.due = 0; delete r.la; delete r.k; }
}

// ---------- очки и серия ----------
function addXP(n) { const k = dayKey(today()); S.xp[k] = (S.xp[k] || 0) + n; }
const xpToday = () => S.xp[dayKey(today())] || 0;
function bumpStreak() {
  const t = today(), st = S.streak;
  if (st.last === t) return;
  st.count = st.last === t - 1 ? st.count + 1 : 1;
  st.last = t;
  st.best = Math.max(st.best || 0, st.count);
}
const streakNow = () => (S.streak.last >= today() - 1 ? S.streak.count : 0);
const streakToday = () => S.streak.last === today();

// ---------- звук ----------
let player = null;
function speak(w, example = false) {
  if (!w) return;
  const text = example ? w.ex : w.w;
  if (!text) return;
  if (player) { player.pause(); player = null; }
  window.speechSynthesis?.cancel();
  if (!w.audio) return tts(text);
  const a = new Audio(`audio/${S.lang}/${w.id}${example ? 'x' : ''}.mp3`);
  a.playbackRate = S.settings.slow ? 0.8 : 1;
  a.onerror = () => tts(text);
  a.play().catch((e) => { if (e.name !== 'NotAllowedError' && e.name !== 'AbortError') tts(text); });
  player = a;
}
function tts(text) {
  if (!window.speechSynthesis) return;
  const lang = LANGS[S.lang].speech;
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace('_', '-').startsWith(lang.slice(0, 2)));
  const rank = (v) => (/natural|neural|online/i.test(v.name) ? 3 : 0) + (/google|microsoft/i.test(v.name) ? 1 : 0) + (v.lang.replace('_', '-') === lang ? 1 : 0);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.voice = voices.sort((a, b) => rank(b) - rank(a))[0] || null;
  u.rate = S.settings.slow ? 0.75 : 0.95;
  speechSynthesis.speak(u);
}
let actx = null;
function sfx(kind) {
  if (!S.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [[587, 0], [880, 0.08]], bad: [[247, 0], [196, 0.1]], done: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]] }[kind];
    for (const [f, dt] of notes) {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + dt;
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.25);
    }
  } catch {}
}

// ---------- проверка ввода ----------
const stripAcc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s) => s.toLowerCase().replace(/[.,!?¡¿;:"«»()]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
function answers(w) {
  const out = new Set();
  for (const part of w.w.split(/[\/,;]/)) {
    const a = norm(part);
    if (!a) continue;
    out.add(a);
    out.add(a.replace(/^(to|el|la|los|las|un|una|lo) /, ''));
    if (w.pos === 'v' && S.lang === 'en') out.add('to ' + a);
  }
  return [...out];
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
function checkTyped(input, w) {
  const v = norm(input);
  if (!v) return 'empty';
  const list = answers(w);
  if (list.includes(v)) return 'exact';
  if (list.some((a) => stripAcc(a) === stripAcc(v))) return 'accent';
  if (v.length >= 4 && list.some((a) => lev(stripAcc(a), stripAcc(v)) <= 1)) return 'typo';
  return 'wrong';
}
// варианты ответа: та же часть речи, по возможности та же тема, без одинаковых
function distractors(w, field, n = 3) {
  const all = D().words.filter((x) => x.id !== w.id && x[field] && norm(x[field]) !== norm(w[field]));
  const seen = new Set([norm(w[field])]);
  const take = (list) => {
    const out = [];
    for (const x of shuffle(list.slice())) {
      const k = norm(x[field]);
      if (seen.has(k)) continue;
      seen.add(k); out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };
  let res = take(all.filter((x) => x.pos === w.pos && x.cat === w.cat));
  if (res.length < n) res = res.concat(take(all.filter((x) => x.pos === w.pos)).slice(0, n - res.length));
  if (res.length < n) res = res.concat(take(all).slice(0, n - res.length));
  return res;
}

// ---------- графика ----------
const IC = {
  close: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  search: '<svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg class="ic" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
  speaker: '<svg class="spk" viewBox="0 0 24 24"><path d="M4 9.5v5h3.6l4.9 4.3V5.2L7.6 9.5z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24"><path d="M3 10v4M6 7.5v9M18 7.5v9M21 10v4M6 12h12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z" fill="currentColor"/></svg>',
  cards: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="12" height="15" rx="2.5" fill="currentColor" opacity=".55"/><rect x="4" y="6" width="12" height="15" rx="2.5" fill="currentColor"/></svg>',
};
// цветные иконки меню и статистики
const ICON = {
  get review() { return ICON.repeat; },
  learn: '<svg viewBox="0 0 32 32"><path d="M5 14.5 16 5l11 9.5V27a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 5 27z" fill="#ffc800"/><path d="M3 15.5 16 4l13 11.5" fill="none" stroke="#ff4b4b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="12.5" y="18" width="7" height="10.5" rx="1.5" fill="#e5a000"/></svg>',
  words: '<svg viewBox="0 0 32 32"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4H26v21H7.5A2.5 2.5 0 0 0 5 27.5z" fill="#1cb0f6"/><path d="M5 27.5A2.5 2.5 0 0 1 7.5 25H26v3.5H7.5A2.5 2.5 0 0 1 5 27.5z" fill="#ddf4ff"/><path d="M11 10h10M11 14.5h7" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  cards: '<svg viewBox="0 0 32 32"><rect x="11" y="3.5" width="16" height="21" rx="3.5" fill="#ce82ff" transform="rotate(8 19 14)"/><rect x="5" y="7" width="16" height="21" rx="3.5" fill="#58cc02"/><path d="M10 15.5l2.5 2.5 5-5.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  profile: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ff9600"/><path d="M8 7 9 15l5-4zM24 7l-1 8-5-4z" fill="#ff9600"/><circle cx="12" cy="16" r="2.2" fill="#4b4b4b"/><circle cx="20" cy="16" r="2.2" fill="#4b4b4b"/><path d="M14.5 20.5q1.5 1.5 3 0" fill="none" stroke="#4b4b4b" stroke-width="1.8" stroke-linecap="round"/></svg>',
  fire: '<svg viewBox="0 0 32 32"><path d="M16 2.5c1.5 5 7.5 7.5 8.5 14 .9 6.3-3.6 12.5-8.5 12.5S6.6 25 7.5 18.5C8.1 14 11 12.5 11.5 8c2 1.5 3 3.5 3 5.5 1.5-3 2-7 1.5-11z" fill="#ff9600"/><path d="M16 15c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-2.5 1.5-3.5 2-5.5.8.8 1.3 1.6 1.4 2.6.6-1.4.9-3.2.6-5.1z" fill="#ffc800"/></svg>',
  fireOff: '<svg viewBox="0 0 32 32"><path d="M16 2.5c1.5 5 7.5 7.5 8.5 14 .9 6.3-3.6 12.5-8.5 12.5S6.6 25 7.5 18.5C8.1 14 11 12.5 11.5 8c2 1.5 3 3.5 3 5.5 1.5-3 2-7 1.5-11z" fill="#e5e5e5"/></svg>',
  bolt: '<svg viewBox="0 0 32 32"><path d="M18.5 2.5 6 18h8.5l-2 11.5L26 13h-8.7z" fill="#ffc800" stroke="#e5a000" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  book: '<svg viewBox="0 0 32 32"><path d="M4 7c4-2 8-2 12 1 4-3 8-3 12-1v19c-4-2-8-2-12 1-4-3-8-3-12-1z" fill="#58cc02"/><path d="M16 8v19" stroke="#58a700" stroke-width="2"/></svg>',
  target: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#ff4b4b"/><circle cx="16" cy="16" r="8.5" fill="#fff"/><circle cx="16" cy="16" r="4.5" fill="#ff4b4b"/></svg>',
  repeat: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#1cb0f6"/><path d="M10 14.5a6.5 6.5 0 0 1 11.5-3.5M22 17.5a6.5 6.5 0 0 1-11.5 3.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/><path d="m21.5 7.5.3 4-4 .2M10.5 24.5l-.3-4 4-.2" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cats: '<svg viewBox="0 0 32 32"><rect x="4" y="4" width="11" height="11" rx="3" fill="#ff4b4b"/><rect x="17" y="4" width="11" height="11" rx="3" fill="#ffc800"/><rect x="4" y="17" width="11" height="11" rx="3" fill="#1cb0f6"/><rect x="17" y="17" width="11" height="11" rx="3" fill="#58cc02"/></svg>',
  chest: '<svg viewBox="0 0 32 32"><rect x="4" y="12" width="24" height="15" rx="3" fill="#ff9600"/><path d="M4 15a10 7 0 0 1 24 0v-1a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3z" fill="#ffc800"/><path d="M4 14a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v3H4z" fill="#ffc800"/><rect x="13" y="15" width="6" height="7" rx="1.5" fill="#fff"/></svg>',
};

// Маскот — рыжий кот. mood: idle | happy | sad | think
function cat(mood = 'idle', size = 96) {
  const eyes = mood === 'happy'
    ? '<path d="M34 68q10-12 20 0M66 68q10-12 20 0" fill="none" stroke="#4b4b4b" stroke-width="5" stroke-linecap="round"/>'
    : mood === 'sad'
      ? '<ellipse cx="44" cy="68" rx="12" ry="13" fill="#fff"/><ellipse cx="76" cy="68" rx="12" ry="13" fill="#fff"/><circle cx="44" cy="72" r="6.5" fill="#4b4b4b"/><circle cx="76" cy="72" r="6.5" fill="#4b4b4b"/><path d="M31 53l17 7M89 53l-17 7" stroke="#b35c00" stroke-width="4" stroke-linecap="round"/>'
      : `<ellipse cx="44" cy="66" rx="13" ry="15" fill="#fff"/><ellipse cx="76" cy="66" rx="13" ry="15" fill="#fff"/><circle cx="${mood === 'think' ? 41 : 47}" cy="${mood === 'think' ? 62 : 68}" r="7.5" fill="#4b4b4b"/><circle cx="${mood === 'think' ? 73 : 79}" cy="${mood === 'think' ? 62 : 68}" r="7.5" fill="#4b4b4b"/><circle cx="${mood === 'think' ? 44 : 50}" cy="${mood === 'think' ? 59 : 64.5}" r="2.6" fill="#fff"/><circle cx="${mood === 'think' ? 76 : 82}" cy="${mood === 'think' ? 59 : 64.5}" r="2.6" fill="#fff"/>`;
  const mouth = mood === 'happy'
    ? '<path d="M50 87q10 15 20 0z" fill="#a8323e"/><path d="M54.5 93q5.5 4.5 11 0" fill="#ff8fab"/>'
    : mood === 'sad'
      ? '<path d="M52 93q8-6 16 0" fill="none" stroke="#4b4b4b" stroke-width="3" stroke-linecap="round"/>'
      : '<path d="M60 85q-4 6-9 3M60 85q4 6 9 3" fill="none" stroke="#4b4b4b" stroke-width="2.6" stroke-linecap="round"/>';
  return `<svg class="cat cat-${mood}" width="${size}" height="${Math.round(size * 1.08)}" viewBox="0 0 120 130" aria-hidden="true">
    <path class="cat-tail" d="M98 110c18-2 20-28 7-38" fill="none" stroke="#e08600" stroke-width="11" stroke-linecap="round"/>
    <path d="M26 54 21 12l32 22zM94 54l5-42-32 22z" fill="#ff9600"/>
    <path d="M30 46 28 22l17 13zM90 46l2-24-17 13z" fill="#ff8fab"/>
    <path d="M60 28c34 0 46 26 46 54 0 30-19 44-46 44S14 112 14 82c0-28 12-54 46-54z" fill="#ff9600"/>
    <path d="M60 28c34 0 46 26 46 54 0 30-19 44-46 44 20-8 30-24 30-46 0-26-10-44-30-52z" fill="#e88a00" opacity=".45"/>
    <ellipse cx="60" cy="103" rx="27" ry="19" fill="#ffd59e"/>
    <path d="M52 36l2 9M60 34v10M68 36l-2 9" stroke="#e07800" stroke-width="4" stroke-linecap="round"/>
    ${eyes}
    <circle cx="31" cy="83" r="5.5" fill="#ff8fab" opacity=".7"/><circle cx="89" cy="83" r="5.5" fill="#ff8fab" opacity=".7"/>
    <path d="M55.5 79h9l-4.5 5.5z" fill="#ff6f91"/>
    ${mouth}
    <path d="M20 78h-12M21 84l-11 3M100 78h12M99 84l11 3" stroke="#c96f00" stroke-width="1.8" stroke-linecap="round"/>
    <ellipse cx="44" cy="124" rx="11" ry="6" fill="#ffb04a"/><ellipse cx="76" cy="124" rx="11" ry="6" fill="#ffb04a"/>
  </svg>`;
}
const say = (id, cls = '', ex = false) => `<button class="say ${cls}" data-act="${ex ? 'say-ex' : 'say'}" data-id="${esc(id)}" aria-label="Послушать">${IC.speaker}</button>`;
const POS_RU = { n: 'сущ.', v: 'глаг.', adj: 'прил.', adv: 'нареч.', prep: 'предлог', pron: 'местоим.', conj: 'союз', det: 'опред.', num: 'числ.', int: 'межд.', phr: 'фраза' };

// ---------- роутинг и каркас ----------
const route = () => (location.hash.replace(/^#\/?/, '') || 'learn').split('/');
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

const app = $('#app');
let busy = false;

async function render() {
  if (!S.lang || !LP().level) return renderOnboarding();
  if (!D()) {
    if (busy) return;
    busy = true;
    app.innerHTML = `<div class="boot">${cat('idle', 110)}<div class="boot-word">dLang</div></div>`;
    try { await loadLang(S.lang); } catch (e) {
      app.innerHTML = `<div class="boot">${cat('sad', 110)}<p>Не удалось загрузить слова<br><small>${esc(e.message)}</small></p><button class="btn btn-green" onclick="location.reload()">Обновить</button></div>`;
      busy = false;
      return;
    }
    busy = false;
  }
  const [page, arg] = route();
  if (page === 'lesson') return lesson ? renderLesson() : go('#/learn');
  if (page === 'cards') return cards ? renderCardSession() : go('#/review');
  const views = { learn: renderLearn, cats: () => renderCats(arg), review: renderReview, words: () => renderWords(arg), profile: renderProfile };
  const name = views[page] ? page : 'learn';
  app.innerHTML = `
    <div class="shell">
      ${sidebar(name)}
      <main class="main main-${name}">${views[name]()}</main>
      <aside class="rail">${railView()}</aside>
    </div>
    ${tabbar(name)}`;
  afterRender[name]?.();
}
const afterRender = {};
const NAV = [['learn', 'Учить'], ['cats', 'Категории'], ['review', 'Повторение'], ['words', 'Словарь'], ['profile', 'Профиль']];
function sidebar(page) {
  return `<nav class="sidebar">
    <a class="logo" href="#/learn">dLang</a>
    ${NAV.map(([id, label]) => `<a href="#/${id}" class="side-item ${page === id ? 'on' : ''}">${ICON[id]}<span>${label}</span></a>`).join('')}
  </nav>`;
}
function tabbar(page) {
  return `<nav class="tabbar">${NAV.map(([id, label]) => `<a href="#/${id}" class="tab ${page === id ? 'on' : ''}">${ICON[id]}<span>${label}</span></a>`).join('')}</nav>`;
}
// «Выучено» — все слова, которые уже пройдены (изучаю + изучено), «осталось» — ещё не тронутые.
function statsBar() {
  const c = counts(), learned = c.learned + c.learning, todayN = dayStat().n;
  return `<div class="statsbar">
    <button class="lang-btn" data-act="lang-sheet" aria-label="Язык">${LANGS[S.lang].flag}</button>
    <div class="top-nums">
      <div class="top-num"><b class="c-green">${learned}</b><small>выучено</small></div>
      <div class="top-num"><b>${c.new}</b><small>осталось</small></div>
      <div class="top-num"><b class="c-blue">+${todayN}</b><small>сегодня</small></div>
    </div>
  </div>
  <div class="top-bar" title="${learned} из ${c.total}"><i style="width:${(learned / c.total) * 100}%"></i></div>`;
}
function railView() {
  return `${statsBar()}${dailyCard()}${questsCard()}`;
}

// ---------- онбординг ----------
const ob = { step: 0, sel: null, lang: null, level: null };
function renderOnboarding() {
  const lang = ob.lang || S.lang;
  let bubble, options;
  if (ob.step === 0 || !lang) {
    bubble = 'Привет! Я Рыжик. Какой язык будем учить?';
    options = Object.entries(LANGS).map(([id, l]) => `
      <button class="pick-card ${ob.sel === id ? 'sel' : ''}" data-act="ob-pick" data-v="${id}">
        ${l.flag}<span><b>${l.name}</b><small>${l.total}</small></span></button>`).join('');
  } else if (ob.step === 1) {
    bubble = 'Как хорошо ты знаешь язык?';
    options = LANGS[lang].levels.map((lv) => `
      <button class="pick-row ${ob.sel === lv ? 'sel' : ''}" data-act="ob-pick" data-v="${lv}">
        <span class="lvl-bars l${LEVELS.indexOf(lv) + 1}"><i></i><i></i><i></i><i></i></span>
        <span><b>${LEVEL_INFO[lv][1]}</b><small>${lv} · ${LEVEL_INFO[lv][0]}</small></span></button>`).join('');
  } else {
    bubble = 'Сколько новых слов в день будем учить?';
    options = GOALS.map(([n, label]) => `
      <button class="pick-row ${String(ob.sel) === String(n) ? 'sel' : ''}" data-act="ob-pick" data-v="${n}">
        <span><b>${label}</b></span><small class="right">${words(n)} в день</small></button>`).join('');
  }
  app.innerHTML = `
    <main class="onboarding">
      <header class="ob-top">
        ${ob.step ? `<button class="icon-btn" data-act="ob-back">${IC.back}</button>` : '<span></span>'}
        <div class="progress"><i style="width:${(ob.step / 3) * 100}%"></i></div>
      </header>
      <section class="ob-body">
        <div class="speaker-row">${cat(ob.step === 0 ? 'happy' : 'idle', 104)}<div class="bubble">${bubble}</div></div>
        <div class="ob-options ${ob.step === 0 ? 'grid' : ''}">${options}</div>
      </section>
      <footer class="ob-foot"><button class="btn btn-green btn-wide" data-act="ob-next" ${ob.sel == null ? 'disabled' : ''}>Продолжить</button></footer>
    </main>`;
}

// ---------- учить: карточки сложности ----------
function dailyCard() {
  const lp = LP(), done = dayStat().n, goal = lp.daily, due = dueIds().length, lv = mainLevel();
  const pct = clamp(done / goal, 0, 1) * 100;
  return `<section class="panel daily">
    <div class="daily-head">${cat(done >= goal ? 'happy' : 'idle', 58)}
      <div><h3>${done >= goal ? 'Цель дня выполнена!' : 'Цель дня'}</h3>
        <div class="pbar ${done >= goal ? 'gold' : ''}"><i style="width:${pct}%"></i><span>${done} / ${goal}</span></div></div>
    </div>
    <div class="daily-actions">
      ${lv || freshOf(levelWords('mine')).length ? `<button class="btn btn-green btn-wide" data-act="learn-main">${done ? 'Ещё новые слова' : 'Учить новые слова'}</button>` : ''}
      ${due ? `<button class="btn btn-blue-ghost btn-wide" data-act="deck-quiz" data-deck="due">Повторить · ${due}</button>` : ''}
    </div>
    ${lv ? `<p class="daily-note">Случайные слова: ${LEVEL_NAME[lv].toLowerCase()} · ${lv}</p>` : ''}
  </section>`;
}
function questsCard() {
  const lp = LP(), d = dayStat(), due = dueIds().length;
  const q = [
    [ICON.book, `Выучи ${words(lp.daily)}`, d.n, lp.daily],
    d.r + due ? [ICON.repeat, 'Повтори слова на сегодня', d.r, d.r + due] : [ICON.repeat, 'Пройди 2 урока', d.l || 0, 2],
  ];
  return `<section class="panel quests"><h3>Задания дня</h3>
    ${q.map(([icon, title, v, max]) => { const ok = v >= max; return `<div class="quest">${icon}<div><b>${title}</b>
      <div class="pbar sm ${ok ? 'gold' : ''}"><i style="width:${clamp(v / max, 0, 1) * 100}%"></i><span>${Math.min(v, max)} / ${max}</span></div></div>${ok ? ICON.chest : ''}</div>`; }).join('')}
  </section>`;
}
function levelCard(key, title, tag, list, color) {
  const c = counts(list), done = c.learned + c.learning;
  return `<button class="level-card u-${color}" data-act="learn-level" data-lv="${key}">
    <div class="lc-head"><span class="lc-tag">${tag}</span>${key === LP().level ? '<span class="lc-mine">мой уровень</span>' : ''}</div>
    <h3>${title}</h3>
    <div class="lc-bar"><i style="width:${c.total ? (done / c.total) * 100 : 0}%"></i></div>
    <div class="lc-foot"><span>${done} из ${c.total}</span><span class="lc-go">${c.new ? 'Учить' : 'Повторить'}${IC.chevron}</span></div>
  </button>`;
}
function renderLearn() {
  const custom = levelWords('mine'), due = dueIds().length;
  return `<div class="mobile-only">${statsBar()}${dailyCard()}</div>
    <h2 class="h2 first">Сложность</h2>
    <p class="lead">Выбери уровень — я наберу случайные новые слова.</p>
    <div class="level-grid">
      ${LANGS[S.lang].levels.map((lv) => levelCard(lv, LEVEL_NAME[lv], lv, levelWords(lv), LEVEL_COLOR[lv])).join('')}
      ${custom.length ? levelCard('mine', 'Мои слова', 'свои', custom, 'pink') : ''}
    </div>
    <div class="quick-row">
      <a class="quick" href="#/cats">${ICON.cats}<span><b>Категории</b><small>Учи слова по темам</small></span></a>
      <a class="quick" href="#/review">${ICON.repeat}<span><b>Повторение</b><small>${due ? `${words(due)} пора повторить` : 'Прогони старые слова'}</small></span></a>
    </div>`;
}

// ---------- категории ----------
function catList() {
  const db = D();
  return [...db.cats, MINE, OLD].map((c) => [c, db.words.filter((w) => w.cat === c.id)]).filter(([, ws]) => ws.length);
}
const catColor = (id) => UNIT_COLORS[Math.max(0, catList().findIndex(([c]) => c.id === id)) % UNIT_COLORS.length];
function renderCats(arg) {
  if (arg && D().catMap.has(arg)) return renderCat(arg);
  return `<header class="page-head"><h1>Категории</h1></header>
    <div class="cat-grid">${catList().map(([c, ws], i) => {
      const cn = counts(ws), done = cn.learned + cn.learning, pct = Math.round((done / cn.total) * 100);
      return `<a class="cat-tile u-${UNIT_COLORS[i % UNIT_COLORS.length]}" href="#/cats/${c.id}">
        <span class="ct-ring" style="--p:${pct}"><b>${pct}%</b></span>
        <span class="ct-txt"><b>${esc(c.name)}</b><small>${done} из ${cn.total}</small></span>
      </a>`;
    }).join('')}</div>`;
}
function renderCat(id) {
  const c = D().catMap.get(id), list = D().words.filter((w) => w.cat === id), cn = counts(list), done = cn.learned + cn.learning;
  const sorted = list.slice().sort((a, b) => LEVELS.indexOf(a.lvl) - LEVELS.indexOf(b.lvl));
  return `<header class="page-head"><a class="icon-btn" href="#/cats" aria-label="Назад">${IC.back}</a><h1 class="grow">${esc(c.name)}</h1></header>
    <section class="cat-hero u-${catColor(id)}">
      <div class="ch-nums"><b>${done}</b><span>из ${words(cn.total)} выучено</span></div>
      <div class="lc-bar"><i style="width:${(done / cn.total) * 100}%"></i></div>
      <div class="ch-actions">
        <button class="btn btn-white" data-act="cat-learn" data-cat="${esc(id)}" ${cn.new ? '' : 'disabled'}>Учить новые</button>
        <button class="btn btn-white" data-act="cat-quiz" data-cat="${esc(id)}" ${done ? '' : 'disabled'}>Квиз по выученным</button>
        <button class="btn btn-white" data-act="cat-cards" data-cat="${esc(id)}">Карточки</button>
      </div>
    </section>
    <p class="list-count">${words(cn.total)}</p>
    <div class="word-list">${sorted.map(wordRow).join('')}</div>`;
}

// ---------- занятие ----------
let lesson = null;

function startLesson({ newIds = [], reviewIds = [], practice = false } = {}) {
  if (!newIds.length && !reviewIds.length) return toast('Здесь пока нечего повторять');
  const steps = [], later = [];
  newIds.forEach((id, i) => {
    steps.push({ t: 'intro', id }, { t: 'choice', id });
    later.push({ t: i % 2 ? 'listen' : 'reverse', id });
  });
  for (const id of reviewIds) later.push({ t: reviewType(id), id });
  steps.push(...shuffle(later));
  const matchIds = newIds.length >= 3 ? newIds : practice && reviewIds.length >= 3 ? shuffle(reviewIds.slice()).slice(0, 5) : [];
  if (new Set(matchIds.map((id) => norm(W(id).t))).size >= 3) steps.push({ t: 'match', ids: matchIds.slice(0, 6) });
  lesson = { back: location.hash && location.hash !== '#/lesson' ? location.hash : '#/learn', steps, i: 0, newIds: newIds.slice(), graded: new Set(), retries: {}, correct: 0, total: 0, xp: 0, combo: 0, best: 0, answered: null, sel: null, start: Date.now() };
  go('#/lesson');
}
function reviewType(id) {
  const s = rec(id)?.s || 1;
  return pick(s <= 2 ? ['choice', 'reverse', 'listen'] : ['type', 'type', 'reverse', 'listen']);
}
const step = () => lesson.steps[lesson.i];

function renderLesson() {
  clearTimeout(lesson.timer);
  if (lesson.i >= lesson.steps.length) return renderLessonEnd();
  const st = step(), w = st.id && W(st.id);
  if (st.id && !w) { lesson.i++; return renderLesson(); }
  let body = '';
  if (st.t === 'intro') body = introView(w);
  else if (st.t === 'match') body = matchView(st);
  else if (st.t === 'type') body = typeView(w);
  else body = choiceView(st, w);
  app.innerHTML = `
    <main class="lesson">
      <header class="lesson-top">
        <button class="icon-btn" data-act="quit" aria-label="Выйти">${IC.close}</button>
        <div class="progress"><i style="width:${Math.max(3, (lesson.i / lesson.steps.length) * 100)}%"></i></div>
        <span class="counter">${lesson.newIds.length ? `+${lesson.newIds.filter((id) => status(id) !== 'new').length}` : ''}</span>
      </header>
      <section class="lesson-body">${body}</section>
      ${footerView(st, w)}
    </main>`;
  if (!lesson.answered) {
    if (st.t === 'intro' && S.settings.autoplay) speak(w);
    else if (st.t === 'listen') speak(w);
    else if (st.t === 'choice' && S.settings.autoplay) speak(w);
  }
  if (st.t === 'type' && !lesson.answered) $('#typed')?.focus();
}

function introView(w) {
  const r = rec(w.id);
  return `
    <h1 class="ex-title"><span class="tag-new">Новое слово</span></h1>
    <div class="speaker-row">${cat('happy', 96)}
      <div class="bubble bubble-word">
        <div class="bw-line">${say(w.id, 'say-lg')}<span class="bw-word">${esc(w.w)}</span></div>
        ${w.ipa || POS_RU[w.pos] ? `<div class="bw-meta">${esc(w.ipa || '')}${POS_RU[w.pos] ? ` <span class="pos">${POS_RU[w.pos]}</span>` : ''}</div>` : ''}
      </div>
    </div>
    <div class="intro-card">
      <div class="intro-tr">${esc(w.t)}</div>
      ${w.ex ? `<div class="example">${say(w.id, 'say-sm', true)}<div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div></div>` : ''}
      <label class="assoc"><span>Ассоциация, чтобы запомнить</span>
        <textarea data-assoc="${esc(w.id)}" rows="2" placeholder="Например: ${esc(LANGS[S.lang].tip)}">${esc(r?.as || '')}</textarea></label>
    </div>`;
}
function choiceView(st, w) {
  const reverse = st.t !== 'choice';
  if (!st.opts) st.opts = shuffle([w, ...distractors(w, reverse ? 'w' : 't')]).map((x) => x.id);
  let prompt;
  if (st.t === 'choice') prompt = `<h1 class="ex-title">Выбери перевод</h1>
    <div class="speaker-row">${cat('idle', 96)}<div class="bubble bubble-word"><div class="bw-line">${say(w.id, 'say-lg')}<span class="bw-word">${esc(w.w)}</span></div></div></div>`;
  else if (st.t === 'reverse') prompt = `<h1 class="ex-title">Как сказать ${LANGS[S.lang].in}?</h1>
    <div class="speaker-row">${cat('think', 96)}<div class="bubble bubble-word"><span class="bw-word ru">${esc(w.t)}</span></div></div>`;
  else prompt = `<h1 class="ex-title">Что ты слышишь?</h1>
    <div class="listen-row"><button class="listen-btn" data-act="say" data-id="${esc(w.id)}">${IC.speaker}</button><button class="listen-btn slow" data-act="say-slow" data-id="${esc(w.id)}" aria-label="Медленно"><small>0.8×</small></button></div>`;
  const a = lesson.answered;
  return `${prompt}
    <div class="choices">${st.opts.map((id, i) => {
      const x = W(id);
      let cls = lesson.sel === id ? 'sel' : '';
      if (a) cls = id === w.id ? 'right' : id === lesson.sel ? 'wrong' : '';
      return `<button class="choice ${cls}" data-act="pick" data-id="${esc(id)}" ${a ? 'disabled' : ''}><kbd>${i + 1}</kbd><span>${esc(reverse ? x.w : x.t)}</span></button>`;
    }).join('')}</div>`;
}
function typeView(w) {
  const a = lesson.answered;
  return `
    <h1 class="ex-title">Напиши ${LANGS[S.lang].in}</h1>
    <div class="speaker-row">${cat('think', 96)}<div class="bubble bubble-word"><span class="bw-word ru">${esc(w.t)}</span>${w.exr ? `<small class="bw-hint">${esc(w.exr)}</small>` : ''}</div></div>
    <form class="type-form" data-form="type">
      <textarea id="typed" class="type-input" rows="2" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        lang="${S.lang}" placeholder="Напиши ответ" ${a ? 'disabled' : ''}>${esc(a?.typed || '')}</textarea>
      ${S.lang === 'es' && !a ? `<div class="accents">${'áéíóúñü'.split('').map((ch) => `<button type="button" data-act="accent" data-ch="${ch}">${ch}</button>`).join('')}</div>` : ''}
      ${!a ? '<button type="button" class="link-btn" data-act="hint">Подсказка — первая буква</button>' : ''}
    </form>`;
}
function matchView(st) {
  if (!st.left) {
    const seen = new Set();
    st.left = shuffle(st.ids.filter((id) => { const w = W(id); if (!w || seen.has(norm(w.t)) || seen.has(norm(w.w))) return false; seen.add(norm(w.t)); seen.add(norm(w.w)); return true; }));
    st.right = shuffle(st.left.slice());
    st.done = [];
    st.sel = null;
  }
  const col = (ids, side) => ids.map((id, i) => {
    const w = W(id), done = st.done.includes(id);
    return `<button class="choice match-item ${done ? 'matched' : ''} ${st.sel === id && side === 'l' ? 'sel' : ''}" data-act="match" data-side="${side}" data-id="${esc(id)}" ${done ? 'disabled' : ''}><kbd>${side === 'l' ? i + 1 : i + 1 + ids.length}</kbd><span>${esc(side === 'l' ? w.w : w.t)}</span></button>`;
  }).join('');
  return `<h1 class="ex-title">Найди пары</h1>
    <div class="match"><div class="match-col">${col(st.left, 'l')}</div><div class="match-col">${col(st.right, 'r')}</div></div>`;
}
function footerView(st, w) {
  const a = lesson.answered;
  if (st.t === 'intro') return `<footer class="lesson-foot"><div class="foot-in">
    <div class="foot-left">
      <button class="btn btn-ghost" data-act="intro-known" title="Отметить выученным и убрать из урока">Уже знаю</button>
      <button class="btn btn-ghost" data-act="intro-skip" title="Убрать из урока, слово останется новым">Пропустить</button>
    </div>
    <button class="btn btn-green" data-act="intro-next">Дальше</button></div></footer>`;
  if (st.t === 'match') return `<footer class="lesson-foot"><div class="foot-in">
    <span></span><button class="btn btn-green" data-act="next" ${st.done?.length >= st.left?.length ? '' : 'disabled'}>Дальше</button></div></footer>`;
  if (!a) {
    const ready = st.t === 'type' || lesson.sel;
    return `<footer class="lesson-foot"><div class="foot-in">
      <button class="btn btn-ghost" data-act="skip">Не знаю</button>
      <button class="btn btn-green" data-act="check" ${ready ? '' : 'disabled'}>Проверить</button></div></footer>`;
  }
  const title = a.ok ? (a.note || pick(['Отлично!', 'Верно!', 'Так держать!', 'Супер!', 'Великолепно!'])) : 'Правильный ответ:';
  return `<footer class="lesson-foot ${a.ok ? 'ok' : 'bad'}"><div class="foot-in">
    <div class="fb">
      <span class="fb-icon">${a.ok ? IC.check : IC.close}</span>
      <div><b>${title}</b>
        ${!a.ok || a.note ? `<p>${esc(w.w)} — ${esc(w.t)}</p>` : ''}
        ${!a.ok && w.ex ? `<small>${esc(w.ex)}</small>` : ''}</div>
    </div>
    <button class="btn ${a.ok ? 'btn-green' : 'btn-red'}" data-act="next">${a.ok ? 'Дальше' : 'Понятно'}</button></div></footer>`;
}

function answer(ok, extra = {}) {
  const st = step(), id = st.id;
  lesson.answered = { ok, ...extra };
  lesson.total++;
  if (ok) {
    lesson.correct++; lesson.combo++; lesson.best = Math.max(lesson.best, lesson.combo);
    lesson.xp += 2; addXP(2);
  } else {
    lesson.combo = 0;
    if ((lesson.retries[id] || 0) < 2) {
      lesson.retries[id] = (lesson.retries[id] || 0) + 1;
      lesson.steps.splice(Math.min(lesson.i + 3, lesson.steps.length), 0, { t: 'choice', id });
    }
  }
  if (!lesson.graded.has(id)) {
    lesson.graded.add(id);
    if (!lesson.newIds.includes(id)) grade(id, ok);
  }
  save();
  sfx(ok ? 'ok' : 'bad');
  renderLesson();
  if (st.t !== 'listen') speak(W(id));
}
function checkAnswer() {
  const st = step();
  if (!st || lesson.answered) return;
  const w = W(st.id);
  if (st.t === 'type') {
    const typed = $('#typed').value, res = checkTyped(typed, w);
    if (res === 'empty') return;
    const note = res === 'accent' ? 'Почти! Обрати внимание на ударение' : res === 'typo' ? 'Почти! Небольшая опечатка' : '';
    return answer(res !== 'wrong', { typed, note });
  }
  if (lesson.sel) answer(lesson.sel === w.id);
}
function dropFromLesson(id) {
  lesson.steps = lesson.steps.filter((s, i) => i <= lesson.i || s.id !== id).map((s) => (s.t === 'match' ? { ...s, ids: s.ids.filter((x) => x !== id) } : s))
    .filter((s) => s.t !== 'match' || s.ids.length >= 3);
  lesson.newIds = lesson.newIds.filter((x) => x !== id);
  save();
  nextStep();
}
function nextStep() {
  if (!lesson) return;
  lesson.answered = null;
  lesson.sel = null;
  lesson.i++;
  renderLesson();
}
function renderLessonEnd() {
  if (!lesson.finished) {
    lesson.finished = true;
    lesson.xp += 5; addXP(5);
    dayStat().l = (dayStat().l || 0) + 1;
    bumpStreak();
    save();
    sfx('done');
  }
  const acc = lesson.total ? Math.round((lesson.correct / lesson.total) * 100) : 100;
  const secs = Math.round((Date.now() - lesson.start) / 1000);
  const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const learnedNow = lesson.newIds.filter((id) => status(id) !== 'new').length;
  app.innerHTML = `
    <main class="lesson-end">
      <div class="end-hero">${cat(acc >= 70 ? 'happy' : 'idle', 150)}</div>
      <h1>${acc >= 90 ? 'Урок пройден идеально!' : acc >= 70 ? 'Урок пройден!' : 'Хорошая тренировка!'}</h1>
      <p class="end-sub">Сегодня выучено: ${words(dayStat().n)}</p>
      <div class="end-stats">
        <div class="end-stat yellow"><small>Новых слов</small><b>+${learnedNow}</b></div>
        <div class="end-stat green"><small>${acc >= 90 ? 'Отлично' : 'Точность'}</small><b>${IC.check}${acc}%</b></div>
        <div class="end-stat blue"><small>Время</small><b>${time}</b></div>
      </div>
      <footer class="end-foot">
        <button class="btn btn-green btn-wide" data-act="end-next">Дальше</button>
      </footer>
    </main>`;
}

// ---------- словарь ----------
const wv = { q: '', seg: 'all', cat: '', limit: 120 };
const SEGS = [['all', 'Все'], ['new', 'Новые'], ['learning', 'Изучаю'], ['learned', 'Изучено'], ['star', 'Избранное']];

function filterWords() {
  const q = norm(wv.q), qa = stripAcc(q);
  return D().words.filter((w) => {
    if (wv.cat && w.cat !== wv.cat) return false;
    if (wv.seg === 'star') { if (!rec(w.id)?.st) return false; }
    else if (wv.seg !== 'all' && status(w.id) !== wv.seg) return false;
    if (q) return stripAcc(norm(w.w)).includes(qa) || norm(w.t).includes(q);
    return true;
  });
}
function wordRow(w) {
  const st = status(w.id), r = rec(w.id);
  return `<div class="word-row" data-act="word" data-id="${esc(w.id)}">
    ${say(w.id, 'say-sm')}
    <div class="wr-main"><b>${esc(w.w)}${r?.st ? ' <span class="star-on">★</span>' : ''}</b><span>${esc(w.t)}</span></div>
    <span class="st-pill st-${st}">${STATUS_NAME[st]}</span>
  </div>`;
}
function listHTML() {
  const list = filterWords();
  if (!list.length) return `<div class="empty">${cat('think', 90)}<p>${wv.q ? 'Ничего не нашлось' : wv.seg === 'star' ? 'Отмечай слова звёздочкой — они соберутся здесь' : 'Пока пусто'}</p></div>`;
  return `<p class="list-count">${words(list.length)}</p>` + list.slice(0, wv.limit).map(wordRow).join('') +
    (list.length > wv.limit ? `<button class="btn btn-ghost btn-wide" data-act="more-rows">Показать ещё ${list.length - wv.limit}</button>` : '');
}
function renderWords(arg) {
  if (arg && D().catMap.has(arg)) { wv.cat = arg; history.replaceState(null, '', '#/words'); }
  const c = counts();
  const cats = [['', 'Все темы'], ...[...D().cats, MINE, OLD].filter((x) => D().words.some((w) => w.cat === x.id)).map((x) => [x.id, x.name])];
  return `
    <header class="page-head"><h1>Словарь</h1><button class="btn btn-blue btn-sm" data-act="add-word">${IC.plus}<span>Своё слово</span></button></header>
    <div class="dict-stats">
      <div><b class="c-green">${c.learned}</b><small>изучено</small></div>
      <div><b class="c-orange">${c.learning}</b><small>изучаю</small></div>
      <div><b>${c.new}</b><small>впереди</small></div>
    </div>
    <div class="search">${IC.search}<input id="wsearch" type="search" placeholder="Найти слово или перевод" value="${esc(wv.q)}"></div>
    <div class="tabs-line">${SEGS.map(([id, label]) => `<button class="tl ${wv.seg === id ? 'on' : ''}" data-act="seg" data-seg="${id}">${label}</button>`).join('')}</div>
    <div class="chips-scroll">${cats.map(([id, name]) => `<button class="chip ${wv.cat === id ? 'on' : ''}" data-act="cat-filter" data-cat="${esc(id)}">${esc(name)}</button>`).join('')}</div>
    <div id="wlist" class="word-list">${listHTML()}</div>`;
}
afterRender.words = () => {
  const input = $('#wsearch');
  input?.addEventListener('input', () => { wv.q = input.value; wv.limit = 120; $('#wlist').innerHTML = listHTML(); });
};

// ---------- повторение и карточки ----------
let cards = null;
let cardDir = 'front';
function reviewDecks() {
  const all = LP().words, t = today(), main = mainLevel();
  const by = (fn) => D().words.filter(fn).map((w) => w.id);
  return [
    ['learned', ICON.book, 'Все выученные', 'Случайные слова из всего, что знаешь', by((w) => status(w.id) !== 'new')],
    ['hard', ICON.target, 'Трудные слова', 'Где ты ошибался чаще всего', by((w) => (all[w.id]?.bad || 0) > 0).sort((a, b) => all[b].bad - all[a].bad)],
    ['recent', ICON.words, 'Недавно выученные', 'За последние 7 дней', by((w) => (all[w.id]?.first ?? -99) >= t - 7)],
    ['learning', ICON.repeat, 'Ещё не закрепились', 'Слова в процессе изучения', by((w) => status(w.id) === 'learning')],
    ['star', ICON.cards, 'Избранное', 'Слова со звёздочкой', by((w) => all[w.id]?.st)],
    ['sift', ICON.cats, 'Проверь новые слова', 'Знаешь — свайп вправо, и слово не попадёт в уроки', main ? shuffle(freshOf(levelWords(main))).slice(0, 30) : []],
  ];
}
const deckIds = (id) => (id === 'due' ? dueIds() : reviewDecks().find((d) => d[0] === id)?.[4] || []);
const dirToggle = () => `<div class="seg2"><button class="${cardDir === 'front' ? 'on' : ''}" data-act="dir" data-dir="front">${S.lang.toUpperCase()} → RU</button><button class="${cardDir === 'back' ? 'on' : ''}" data-act="dir" data-dir="back">RU → ${S.lang.toUpperCase()}</button></div>`;
function renderReview() {
  const due = dueIds().length;
  return `<header class="page-head"><h1>Повторение</h1>${dirToggle()}</header>
    <section class="due-card">
      ${cat(due ? 'think' : 'happy', 72)}
      <div class="dc-txt"><b>${due ? `Пора повторить: ${words(due)}` : 'На сегодня всё повторено'}</b><small>${due ? 'Эти слова начинают забываться' : 'Можно прогнать старые слова ниже'}</small></div>
      ${due ? `<div class="dc-actions"><button class="btn btn-green" data-act="deck-quiz" data-deck="due">Квиз</button><button class="btn btn-ghost" data-act="deck-cards" data-deck="due">Карточки</button></div>` : ''}
    </section>
    <h2 class="h2">Прогнать слова</h2>
    <div class="deck-list">${reviewDecks().map(([id, icon, name, sub, ids]) => `
      <div class="deck ${ids.length ? '' : 'off'}">
        <span class="deck-ic">${icon}</span>
        <span class="deck-txt"><b>${name} <span class="deck-n">${ids.length}</span></b><small>${sub}</small></span>
        <span class="deck-btns">
          ${id !== 'sift' ? `<button class="btn btn-sm btn-blue" data-act="deck-quiz" data-deck="${id}" ${ids.length ? '' : 'disabled'}>Квиз</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-act="deck-cards" data-deck="${id}" ${ids.length ? '' : 'disabled'}>Карточки</button>
        </span>
      </div>`).join('')}</div>`;
}
function startCards(ids, kind, back = '#/review') {
  if (!ids.length) return toast('Здесь пока нет слов');
  const list = kind === 'sift' ? ids.slice(0, 40) : shuffle(ids.slice()).slice(0, 30);
  cards = { ids: list, i: 0, flipped: false, know: [], again: [], kind, back };
  go('#/cards');
}
function renderCardSession() {
  const c = cards;
  if (c.i >= c.ids.length) {
    app.innerHTML = `
      <main class="lesson-end">
        <div class="end-hero">${cat('happy', 140)}</div>
        <h1>Колода пройдена!</h1>
        <div class="end-stats two">
          <div class="end-stat green"><small>Знаю</small><b>${c.know.length}</b></div>
          <div class="end-stat red"><small>Повторить</small><b>${c.again.length}</b></div>
        </div>
        <footer class="end-foot">
          ${c.again.length ? '<button class="btn btn-ghost btn-wide" data-act="cards-again">Ещё раз незнакомые</button>' : ''}
          <button class="btn btn-green btn-wide" data-act="cards-exit">Готово</button>
        </footer>
      </main>`;
    return;
  }
  const w = W(c.ids[c.i]), r = rec(w.id);
  const front = cardDir === 'front'
    ? `<div class="fc-word">${esc(w.w)}</div>${w.ipa ? `<div class="fc-meta">${esc(w.ipa)}</div>` : ''}${say(w.id, 'say-lg')}`
    : `<div class="fc-word ru">${esc(w.t)}</div>`;
  const back = `
    <div class="fc-small">${cardDir === 'front' ? esc(w.w) : ''}</div>
    <div class="fc-word ${cardDir === 'front' ? 'ru' : ''}">${esc(cardDir === 'front' ? w.t : w.w)}</div>
    ${cardDir === 'back' ? say(w.id, 'say-lg') : ''}
    ${w.ex ? `<div class="example">${say(w.id, 'say-sm', true)}<div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div></div>` : ''}
    ${r?.as ? `<div class="assoc-view"><b>Ассоциация:</b> ${esc(r.as)}</div>` : ''}`;
  app.innerHTML = `
    <main class="lesson cards-session">
      <header class="lesson-top">
        <button class="icon-btn" data-act="cards-exit">${IC.close}</button>
        <div class="progress"><i style="width:${Math.max(3, (c.i / c.ids.length) * 100)}%"></i></div>
        <span class="counter">${c.i + 1}/${c.ids.length}</span>
      </header>
      <section class="deck-stage">
        <div class="swipe-tag left">Ещё раз</div><div class="swipe-tag right">Знаю</div>
        <div class="fcard ${c.flipped ? 'flipped' : ''}" id="fcard">
          <div class="fface front">${front}<p class="tap-hint">Нажми, чтобы перевернуть</p></div>
          <div class="fface back">${back}</div>
        </div>
      </section>
      <footer class="lesson-foot"><div class="foot-in">
        <button class="btn btn-red-ghost" data-act="card-grade" data-ok="0">${c.kind === 'sift' ? 'Не знаю' : 'Ещё раз'}</button>
        <button class="btn btn-green" data-act="card-grade" data-ok="1">Знаю</button>
      </div></footer>
    </main>`;
  if (S.settings.autoplay && cardDir === 'front') speak(w);
  bindSwipe($('#fcard'));
}
function gradeCard(ok) {
  const c = cards, id = c.ids[c.i], st = status(id);
  (ok ? c.know : c.again).push(id);
  if (st === 'new') { if (ok) markKnown(id); }
  else if (!ok || rec(id)?.due <= today()) grade(id, ok);
  if (ok) addXP(1);
  save();
  c.i++; c.flipped = false;
  renderCardSession();
}
function bindSwipe(el) {
  if (!el) return;
  let x0 = null, dx = 0, moved = false;
  el.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; x0 = e.clientX; dx = 0; moved = false; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
  el.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    if (Math.abs(dx) > 6) moved = true;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)${cards.flipped ? ' rotateY(180deg)' : ''}`;
    el.parentElement.dataset.swipe = dx > 40 ? 'right' : dx < -40 ? 'left' : '';
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    el.style.transition = '';
    el.parentElement.dataset.swipe = '';
    if (Math.abs(dx) > 90) {
      el.style.transform = `translateX(${dx > 0 ? 600 : -600}px) rotate(${dx > 0 ? 25 : -25}deg)`;
      setTimeout(() => gradeCard(dx > 0), 180);
    } else {
      el.style.transform = '';
      if (!moved) flipCard();
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
function flipCard() {
  const el = $('#fcard');
  if (!el) return;
  cards.flipped = !cards.flipped;
  el.classList.toggle('flipped', cards.flipped);
  if (cards.flipped && cardDir === 'back') speak(W(cards.ids[cards.i]));
}

// ---------- профиль ----------
function renderProfile() {
  const lp = LP(), c = counts(), t = today();
  const last = Array.from({ length: 7 }, (_, i) => t - 6 + i);
  const perDay = (d) => S.day[dayKey(d)]?.n || 0;
  const maxN = Math.max(5, ...last.map(perDay));
  const week = last.reduce((a, d) => a + perDay(d), 0);
  const wd = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  return `
    <header class="profile-head">
      <div class="avatar">${cat('happy', 104)}</div>
      <div><h1>Мой профиль</h1><p>${LANGS[S.lang].flag}<span>${LANGS[S.lang].name} · уровень ${lp.level}</span></p></div>
    </header>
    <h2 class="h2">Статистика</h2>
    <section class="stat-grid">
      <div class="stat-box">${ICON.book}<div><b>${c.learned + c.learning}</b><small>выучено из ${c.total}</small></div></div>
      <div class="stat-box">${ICON.words}<div><b>${c.new}</b><small>осталось</small></div></div>
      <div class="stat-box">${ICON.target}<div><b>+${dayStat().n}</b><small>сегодня</small></div></div>
      <div class="stat-box">${ICON.repeat}<div><b>+${week}</b><small>за 7 дней</small></div></div>
    </section>
    <h2 class="h2">Новые слова по дням</h2>
    <section class="box week">${last.map((d) => { const v = perDay(d); return `<div class="wk"><b class="wk-n">${v || ''}</b><div class="wk-bar"><i style="height:${Math.max(6, (v / maxN) * 100)}%" class="${v ? 'on' : ''}"></i></div><small>${wd[new Date(d * 864e5).getUTCDay()]}</small></div>`; }).join('')}</section>

    <h2 class="h2">Язык</h2>
    <section class="lang-grid">${Object.entries(LANGS).map(([id, l]) => `
      <button class="pick-card ${S.lang === id ? 'sel' : ''}" data-act="switch-lang" data-lang="${id}">${l.flag}<span><b>${l.name}</b><small>${S.langs[id]?.level ? `уровень ${S.langs[id].level}` : 'начать'}</small></span></button>`).join('')}</section>

    <h2 class="h2">Настройки · ${LANGS[S.lang].name}</h2>
    <section class="box settings">
      <div class="set-col"><span>Мой уровень — для кнопки «Учить новые слова»</span>
        <div class="seg-row">${LANGS[S.lang].levels.map((lv) => `<button class="${lp.level === lv ? 'on' : ''}" data-act="set-level" data-level="${lv}">${lv}</button>`).join('')}</div></div>
      <div class="set-col"><span>Новых слов в день</span>
        <div class="seg-row">${GOALS.map(([n]) => `<button class="${lp.daily === n ? 'on' : ''}" data-act="set-daily" data-n="${n}">${n}</button>`).join('')}</div></div>
    </section>
    <h2 class="h2">Звук</h2>
    <section class="box settings">
      ${toggleRow('autoplay', 'Произносить слова автоматически')}
      ${toggleRow('slow', 'Медленное произношение')}
      ${toggleRow('sound', 'Звуки ответов')}
    </section>
    <h2 class="h2">Данные</h2>
    <section class="box settings">
      <button class="set-row" data-act="import-old"><span>Перенести слова со старого сайта</span>${IC.chevron}</button>
      <button class="set-row" data-act="export"><span>Сохранить прогресс в файл</span>${IC.chevron}</button>
      <label class="set-row"><span>Загрузить прогресс из файла</span>${IC.chevron}<input type="file" accept="application/json" id="import-file" hidden></label>
      <button class="set-row danger" data-act="reset-lang"><span>Сбросить прогресс · ${LANGS[S.lang].name}</span>${IC.chevron}</button>
    </section>
    <p class="foot-note">Прогресс хранится в этом браузере. Озвучка — нейроголоса Microsoft.</p>`;
}
const toggleRow = (key, label) => `<button class="set-row" data-act="toggle" data-key="${key}"><span>${label}</span><i class="switch ${S.settings[key] ? 'on' : ''}"></i></button>`;
afterRender.profile = () => {
  $('#import-file')?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data?.v !== 1 || !data.langs) throw new Error('bad');
      if (!confirm('Заменить текущий прогресс данными из файла?')) return;
      S = { ...blank(), ...data };
      save();
      Object.keys(DB).forEach((l) => indexLang(l));
      toast('Прогресс загружен');
      render();
    } catch { toast('Это не файл прогресса dLang'); }
  });
};

// ---------- шторки ----------
const sheetRoot = $('#sheet-root');
function openSheet(html) {
  sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog"><div class="sheet-grip"></div>${html}</div>`;
  requestAnimationFrame(() => sheetRoot.classList.add('open'));
  document.body.classList.add('noscroll');
}
function closeSheet() {
  if (!sheetRoot.innerHTML) return;
  sheetRoot.classList.remove('open');
  document.body.classList.remove('noscroll');
  setTimeout(() => { if (!sheetRoot.classList.contains('open')) sheetRoot.innerHTML = ''; }, 220);
}
function wordSheet(id) {
  const w = W(id);
  if (!w) return;
  const r = rec(id), st = status(id);
  const next = r?.s ? (r.due <= today() ? 'сегодня' : `через ${days(r.due - today())}`) : '';
  openSheet(`
    <div class="ws">
      <div class="ws-top"><span class="st-pill st-${st}">${STATUS_NAME[st]}</span>${w.lvl ? `<span class="lvl">${w.lvl}</span>` : ''}<span class="ws-cat">${esc(catName(w))}</span>
        <button class="star-btn ${r?.st ? 'on' : ''}" data-act="star" data-id="${esc(id)}" aria-label="В избранное">${IC.star}</button></div>
      <div class="ws-word">${say(w.id, 'say-lg')}<div><h2>${esc(w.w)}</h2>${w.ipa || POS_RU[w.pos] ? `<span class="ws-meta">${esc(w.ipa || '')} ${POS_RU[w.pos] ? `<span class="pos">${POS_RU[w.pos]}</span>` : ''}</span>` : ''}</div></div>
      <div class="ws-tr">${esc(w.t)}</div>
      ${w.ex ? `<div class="example">${say(w.id, 'say-sm', true)}<div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div></div>` : ''}
      <label class="assoc"><span>Моя ассоциация</span>
        <textarea data-assoc="${esc(id)}" rows="3" placeholder="Картинка в голове, созвучие, история — всё, что поможет вспомнить">${esc(r?.as || '')}</textarea></label>
      ${r?.n ? `<p class="ws-stat">Ответов: ${r.ok || 0} верно · ${r.bad || 0} с ошибкой${next ? ` · повторение ${next}` : ''}</p>` : ''}
      <div class="ws-actions">
        ${st !== 'learned' ? `<button class="btn btn-ghost btn-wide" data-act="know" data-id="${esc(id)}">Я знаю это слово</button>` : `<button class="btn btn-ghost btn-wide" data-act="reset-word" data-id="${esc(id)}">Учить заново</button>`}
        ${w.custom ? `<button class="btn btn-ghost btn-wide" data-act="edit-word" data-id="${esc(id)}">Изменить</button>` : ''}
      </div>
    </div>`);
}
function wordForm(id) {
  const w = id ? W(id) : null;
  const r = id ? rec(id) : null;
  const cats = [MINE, ...D().cats];
  openSheet(`
    <form class="form" data-form="word" data-id="${esc(id || '')}">
      <h2>${w ? 'Изменить слово' : 'Своё слово'}</h2>
      <label><span>Слово ${LANGS[S.lang].in}</span><input name="w" required value="${esc(w?.w || '')}" autocomplete="off" lang="${S.lang}" placeholder="${S.lang === 'en' ? 'serendipity' : 'la sobremesa'}"></label>
      <label><span>Перевод</span><input name="t" required value="${esc(w?.t || '')}" autocomplete="off" placeholder="${S.lang === 'en' ? 'счастливая случайность' : 'беседа за столом после еды'}"></label>
      <label><span>Пример <small>— необязательно</small></span><input name="ex" value="${esc(w?.ex || '')}" autocomplete="off" lang="${S.lang}"></label>
      <label><span>Перевод примера <small>— необязательно</small></span><input name="exr" value="${esc(w?.exr || '')}" autocomplete="off"></label>
      <label><span>Ассоциация <small>— необязательно</small></span><textarea name="as" rows="2">${esc(r?.as || '')}</textarea></label>
      <label><span>Тема</span><select name="cat">${cats.map((c) => `<option value="${c.id}" ${(w?.cat || 'mine') === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <div class="form-actions">
        ${w ? `<button type="button" class="btn btn-red-ghost" data-act="delete-word" data-id="${esc(id)}">Удалить</button>` : ''}
        <button class="btn btn-green btn-wide">${w ? 'Сохранить' : 'Добавить'}</button>
      </div>
    </form>`);
  setTimeout(() => $('.form input[name=w]')?.focus(), 250);
}
function saveWordForm(form) {
  const f = new FormData(form);
  const val = (k) => String(f.get(k) || '').trim();
  if (!val('w') || !val('t')) return;
  const lp = LP(), id = form.dataset.id || 'u' + Date.now().toString(36);
  const item = { id, w: val('w'), t: val('t'), ex: val('ex'), exr: val('exr'), cat: val('cat') || 'mine', ipa: '', pos: '', lvl: '' };
  const i = lp.custom.findIndex((c) => c.id === id);
  if (i >= 0) lp.custom[i] = item; else lp.custom.unshift(item);
  const as = val('as');
  if (as || rec(id)) rec(id, true).as = as;
  indexLang();
  save();
  closeSheet();
  toast(i >= 0 ? 'Сохранено' : 'Слово добавлено — оно в разделе «Мои слова» на пути');
  render();
}
function langSheet() {
  openSheet(`<h2>Язык</h2><div class="lang-grid">${Object.entries(LANGS).map(([id, l]) => {
    const lp = S.langs[id];
    const learned = lp ? Object.values(lp.words).filter((r) => r.s >= LEARNED).length : 0;
    return `<button class="pick-card ${S.lang === id ? 'sel' : ''}" data-act="switch-lang" data-lang="${id}">${l.flag}<span><b>${l.name}</b><small>${lp?.level ? `${learned} изучено` : 'начать'}</small></span></button>`;
  }).join('')}</div>`);
}

// ---------- перенос со старого сайта ----------
// Старый сайт хранит прогресс номерами слов (den-statuses: {"1":"known"…}).
// Его список слов я сопоставил с номерами и положил в data/import-<lang>.json —
// при первой загрузке слова отмечаются изученными сами.
async function applyBundledImport(lang) {
  const lp = LP(lang);
  if (lp.importedOld) return;
  try {
    const res = await fetch(`data/import-${lang}.json?v=3`);
    if (!res.ok) return;
    const list = await res.json();
    const db = DB[lang], index = new Map();
    for (const w of db.base) { const k = w.w.toLowerCase(); if (!index.has(k)) index.set(k, []); index.get(k).push(w.id); }
    let n = 0;
    const prev = S.lang;
    S.lang = lang;
    for (const item of list) {
      const ids = index.get(String(item.w).toLowerCase());
      if (ids) { for (const id of ids) if (status(id) !== 'learned') markKnown(id); n++; continue; }
      if (!item.t) continue;
      // слова, которых нет в словаре, — отдельной темой «Со старого сайта»
      const cid = 'o' + String(item.w).toLowerCase().replace(/[^a-z]+/g, '-');
      if (!lp.custom.some((c) => c.id === cid)) lp.custom.push({ id: cid, w: item.w, t: item.t, ex: '', exr: '', cat: 'old', ipa: '', pos: '', lvl: '' });
      markKnown(cid); n++;
    }
    S.lang = prev;
    indexLang(lang);
    lp.importedOld = { at: today(), n };
    save();
    if (n) setTimeout(() => toast(`Перенёс ${words(n)} со старого сайта`), 600);
  } catch {}
}

const SNIPPET = `(async()=>{const o={ls:{},globals:{},files:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o.ls[k]=localStorage.getItem(k)}for(const k of Object.keys(window)){try{const v=window[k];if(v&&typeof v==='object'&&!(v instanceof Node)&&v!==window&&Object.keys(v).length>300)o.globals[k]=JSON.parse(JSON.stringify(v))}catch(e){}}const urls=new Set([location.href,...[...document.scripts].map(s=>s.src).filter(Boolean),...performance.getEntriesByType('resource').map(e=>e.name)]);for(const u of urls){try{if(new URL(u).origin!==location.origin)continue;const t=await(await fetch(u)).text();if(t.length<3e7)o.files[u]=t}catch(e){}}o.html=document.documentElement.outerHTML;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download='old-site-dump.json';document.body.appendChild(a);a.click();console.log('Готово: файл old-site-dump.json скачан')})()`;

function importSheet() {
  const done = LP().importedOld;
  openSheet(`
    <h2>Перенос со старого сайта</h2>
    ${done ? `<p class="import-ok">${IC.check} Уже перенесено: ${words(done.n)}.</p>` : ''}
    <ol class="steps">
      <li>Открой <a href="${OLD_SITE}" target="_blank" rel="noopener">старый сайт</a> в Chrome.</li>
      <li>Нажми <kbd>F12</kbd> → вкладка <b>Console</b>, вставь команду и нажми <kbd>Enter</kbd>.</li>
      <li>Скачается файл <b>old-site-dump.json</b> — скажи об этом Claude, он перенесёт слова.</li>
    </ol>
    <button class="btn btn-blue btn-wide" data-act="copy-snippet">Скопировать команду</button>
    <p class="hint-line">Список слов в виде текста (по одному в строке) можно вставить сюда:</p>
    <textarea id="import-text" class="import-text" rows="4" placeholder="apple&#10;decide — решать&#10;house"></textarea>
    <button class="btn btn-ghost btn-wide" data-act="run-import">Отметить изученными</button>
    <div id="import-result"></div>`);
}
function runImport() {
  const text = $('#import-text').value.trim();
  if (!text) return toast('Сначала вставь слова');
  const index = new Map();
  for (const w of D().words) for (const a of answers(w)) index.set(stripAcc(a), w.id);
  let n = 0, miss = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][A-Za-zÁÉÍÓÚÑÜáéíóúñü' -]*)/);
    if (!m) continue;
    const id = index.get(stripAcc(norm(m[1]))) || index.get(stripAcc(norm(m[1])).replace(/^(to|el|la|los|las|un|una) /, ''));
    if (id) { if (status(id) !== 'learned') { markKnown(id); n++; } } else miss.push(m[1].trim());
  }
  save();
  $('#import-result').innerHTML = `<p class="import-ok">${IC.check} Отмечено: ${words(n)}${miss.length ? `. Нет в словаре: ${miss.length}` : ''}</p>`;
}
function exportProgress() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dlang-progress-${dayKey(today())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- тост ----------
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- события ----------
async function switchLang(lang) {
  closeSheet();
  if (!S.langs[lang]?.level) { ob.lang = lang; ob.step = 1; ob.sel = null; S.lang = lang; LP(lang); return renderOnboarding(); }
  S.lang = lang;
  save();
  try { await loadLang(lang); } catch {}
  go('#/learn');
}

const actions = {
  'ob-pick': (el) => { ob.sel = el.dataset.v; renderOnboarding(); },
  'ob-back': () => { ob.step--; ob.sel = null; renderOnboarding(); },
  'ob-next': () => {
    if (ob.sel == null) return;
    if (ob.step === 0) { ob.lang = ob.sel; S.lang = ob.lang; LP(); ob.step = 1; ob.sel = null; return renderOnboarding(); }
    if (ob.step === 1) { ob.level = ob.sel; ob.step = 2; ob.sel = null; return renderOnboarding(); }
    const lp = LP(ob.lang || S.lang);
    lp.level = ob.level || 'A1';
    lp.daily = +ob.sel;
    S.lang = ob.lang || S.lang;
    ob.step = 0; ob.sel = null;
    save();
    go('#/learn');
  },
  go: (el) => go(el.dataset.to),
  say: (el) => speak(W(el.dataset.id)),
  'say-ex': (el) => speak(W(el.dataset.id), true),
  'say-slow': (el) => { const s = S.settings.slow; S.settings.slow = true; speak(W(el.dataset.id)); S.settings.slow = s; },
  'learn-main': learnMain,
  'learn-level': (el) => learnFrom(levelWords(el.dataset.lv)),
  'cat-learn': (el) => learnFrom(D().words.filter((w) => w.cat === el.dataset.cat)),
  'cat-quiz': (el) => {
    const ids = D().words.filter((w) => w.cat === el.dataset.cat && status(w.id) !== 'new').map((w) => w.id);
    startLesson({ reviewIds: shuffle(ids).slice(0, 15), practice: true });
  },
  'cat-cards': (el) => startCards(D().words.filter((w) => w.cat === el.dataset.cat).map((w) => w.id), 'cat', `#/cats/${el.dataset.cat}`),
  'deck-quiz': (el) => {
    const ids = deckIds(el.dataset.deck);
    startLesson({ reviewIds: shuffle(el.dataset.deck === 'hard' ? ids.slice(0, 15) : ids.slice()).slice(0, 15), practice: true });
  },
  'deck-cards': (el) => startCards(deckIds(el.dataset.deck), el.dataset.deck === 'sift' ? 'sift' : 'deck'),
  word: (el) => wordSheet(el.dataset.id),
  'add-word': () => wordForm(),
  'edit-word': (el) => wordForm(el.dataset.id),
  'delete-word': (el) => {
    if (!confirm('Удалить слово?')) return;
    const lp = LP(), id = el.dataset.id;
    lp.custom = lp.custom.filter((c) => c.id !== id);
    delete lp.words[id];
    indexLang(); save(); closeSheet(); toast('Удалено'); render();
  },
  'lang-sheet': langSheet,
  'switch-lang': (el) => switchLang(el.dataset.lang),
  'set-level': (el) => { LP().level = el.dataset.level; save(); render(); },
  'set-daily': (el) => { LP().daily = +el.dataset.n; save(); render(); },
  toggle: (el) => { S.settings[el.dataset.key] = !S.settings[el.dataset.key]; save(); render(); },
  'close-sheet': closeSheet,
  star: (el) => { const r = rec(el.dataset.id, true); r.st = !r.st; save(); el.classList.toggle('on', r.st); },
  know: (el) => { markKnown(el.dataset.id); save(); closeSheet(); toast('Отмечено как изученное'); render(); },
  'reset-word': (el) => { resetWord(el.dataset.id); save(); closeSheet(); toast('Слово вернётся в уроки'); render(); },
  seg: (el) => { wv.seg = el.dataset.seg; wv.limit = 120; render(); },
  'cat-filter': (el) => { wv.cat = el.dataset.cat; wv.limit = 120; render(); },
  'more-rows': () => { wv.limit += 200; $('#wlist').innerHTML = listHTML(); },
  dir: (el) => { cardDir = el.dataset.dir; render(); },
  'card-grade': (el) => gradeCard(el.dataset.ok === '1'),
  'cards-again': () => startCards(cards.again, cards.kind === 'sift' ? 'sift' : 'again', cards.back),
  'cards-exit': () => { const back = cards?.back || '#/review'; cards = null; go(back); },
  quit: () => { if (lesson.total && !confirm('Закончить урок? Пройденное сохранится.')) return; const back = lesson.back; lesson = null; go(back); },
  'end-next': () => { const back = lesson.back; lesson = null; go(back); },
  'intro-next': () => { introduce(step().id); lesson.xp += 3; addXP(3); save(); nextStep(); },
  'intro-known': () => { const id = step().id; markKnown(id); dropFromLesson(id); },
  // пропуск: слово уходит из урока, но остаётся новым — выпадет в другой раз
  'intro-skip': () => dropFromLesson(step().id),
  pick: (el) => { if (lesson.answered) return; lesson.sel = el.dataset.id; if (step().t !== 'listen') speak(W(el.dataset.id)); renderLesson(); },
  check: checkAnswer,
  skip: () => { if (!lesson.answered) answer(false, { typed: $('#typed')?.value || '' }); },
  next: () => nextStep(),
  hint: () => {
    const w = W(step().id), input = $('#typed'), target = w.w, cur = input.value;
    let n = 0;
    while (n < cur.length && n < target.length && cur[n].toLowerCase() === target[n].toLowerCase()) n++;
    input.value = target.slice(0, Math.min(target.length, n + 1));
    input.focus();
  },
  accent: (el) => { const input = $('#typed'); const s = input.selectionStart ?? input.value.length; input.value = input.value.slice(0, s) + el.dataset.ch + input.value.slice(input.selectionEnd ?? s); input.focus(); input.setSelectionRange(s + 1, s + 1); },
  match: (el) => {
    const st = step(), id = el.dataset.id;
    if (el.dataset.side === 'l') { st.sel = id; speak(W(id)); return renderLesson(); }
    if (!st.sel) return;
    if (st.sel === id) {
      st.done.push(id); st.sel = null; sfx('ok');
      if (st.done.length >= st.left.length) { lesson.xp += 5; addXP(5); save(); }
      renderLesson();
    } else {
      sfx('bad');
      el.classList.add('wrong-flash');
      setTimeout(() => el.classList.remove('wrong-flash'), 450);
    }
  },
  'import-old': importSheet,
  'copy-snippet': async () => { try { await navigator.clipboard.writeText(SNIPPET); toast('Команда скопирована'); } catch { prompt('Скопируй команду:', SNIPPET); } },
  'run-import': runImport,
  export: exportProgress,
  'reset-lang': () => {
    if (!confirm(`Стереть весь прогресс по языку «${LANGS[S.lang].name}»? Свои слова тоже удалятся.`)) return;
    delete S.langs[S.lang];
    if (DB[S.lang]) indexLang(S.lang);
    save();
    ob.lang = S.lang; ob.step = 1; ob.sel = null;
    renderOnboarding();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.closest('.say, .listen-btn, .star-btn')) e.stopPropagation();
  fn(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'word') return saveWordForm(form);
  if (form.dataset.form === 'type') checkAnswer();
});
let assocTimer = null;
document.addEventListener('input', (e) => {
  if (e.target.id === 'typed' && lesson) { $('[data-act=check]')?.toggleAttribute('disabled', !e.target.value.trim()); return; }
  const ta = e.target.closest('[data-assoc]');
  if (!ta) return;
  clearTimeout(assocTimer);
  assocTimer = setTimeout(() => { rec(ta.dataset.assoc, true).as = ta.value.trim(); save(); }, 300);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheetRoot.innerHTML) return closeSheet();
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if (lesson && route()[0] === 'lesson') {
    const st = step();
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!st) return;
      if (typing && document.activeElement.id !== 'typed') return;
      e.preventDefault();
      if (lesson.answered) return nextStep();
      if (st.t === 'intro') return actions['intro-next']();
      if (st.t === 'match') { if (st.done?.length >= st.left?.length) nextStep(); return; }
      return checkAnswer();
    }
    if (!st || typing) return;
    if (/^[1-9]$/.test(e.key)) {
      const btn = st.t === 'match' ? $$('.match-item')[+e.key - 1] : $$('.choice')[+e.key - 1];
      btn?.click();
    }
    if (e.key === ' ' && st.id) { e.preventDefault(); speak(W(st.id)); }
  } else if (cards && route()[0] === 'cards' && !typing) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowRight') gradeCard(true);
    if (e.key === 'ArrowLeft') gradeCard(false);
  }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.speechSynthesis?.getVoices();
window.dlang = { get state() { return S; }, get lesson() { return lesson; }, W: (id) => W(id), mainLevel }; // для отладки из консоли
render();
