// dLang — учим слова карточками каждый день.
// Всё состояние живёт в localStorage (ключ dlang:v1), словари — в data/<lang>.json,
// озвучка — audio/<lang>/<id>.mp3 (слово) и <id>x.mp3 (пример).

const LANGS = {
  en: { name: 'Английский', self: 'English', flag: '<svg class="flag-svg" viewBox="0 0 60 40"><clipPath id="fuk"><rect width="60" height="40" rx="6"/></clipPath><g clip-path="url(#fuk)"><rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="7"/></g></svg>', speech: 'en-US', levels: ['A1', 'A2', 'B1', 'B2'], tip: '«decide — дисайд: дай сайд, выбери сторону»' },
  es: { name: 'Испанский', self: 'Español', flag: '<svg class="flag-svg" viewBox="0 0 60 40"><clipPath id="fes"><rect width="60" height="40" rx="6"/></clipPath><g clip-path="url(#fes)"><rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/></g></svg>', speech: 'es-ES', levels: ['A1', 'A2', 'B1'], tip: '«la playa — плайя: пляж, где плавают»' },
};
const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const LEVEL_INFO = {
  A1: ['Новичок', 'Самые первые слова: я, дом, есть, хороший'],
  A2: ['Базовый', 'Повседневное: решать, погода, дорогой'],
  B1: ['Средний', 'Свободное общение: впечатление, избегать'],
  B2: ['Продвинутый', 'Сложные темы: последствие, значительный'],
};
const DAILY_OPTIONS = [5, 10, 15, 20, 30];
const INTERVALS = [0, 1, 2, 4, 8, 16, 35, 90]; // дни до повторения на каждой ступени
const LEARNED = 4;                              // с этой ступени слово «изучено»
const LESSON_NEW = 5;
const LESSON_REVIEW = 10;
const MINE = { id: 'mine', name: 'Мои слова', emoji: '✍️' };
const OLD_SITE = 'https://den-english-10000.tivishka.chatgpt.site/';

// ---------- утилиты ----------
const $ = (sel, root = document) => root.querySelector(sel);
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

// ---------- состояние ----------
const KEY = 'dlang:v1';
let S = load();

function blank() {
  return { v: 1, lang: null, langs: {}, streak: { count: 0, last: -1, best: 0 }, xp: {}, settings: { autoplay: true, sound: true, slow: false } };
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
  return (S.langs[lang] ||= { level: null, daily: 10, focus: null, words: {}, custom: [], plan: { day: -1, ids: [] } });
}
function rec(id, create) {
  const all = LP().words;
  if (!all[id] && create) all[id] = { s: 0, due: 0 };
  return all[id];
}

// ---------- словари ----------
const DB = {};
const D = () => DB[S.lang];

async function loadLang(lang) {
  if (DB[lang]) return DB[lang];
  const res = await fetch(`data/${lang}.json?v=1`);
  if (!res.ok) throw new Error(`data/${lang}.json: ${res.status}`);
  const data = await res.json();
  DB[lang] = {
    cats: data.cats.map(([id, name, emoji]) => ({ id, name, emoji })),
    base: data.words.map(([id, w, ipa, pos, t, lvl, cat, ex, exr]) => ({ id, w, ipa, pos, t, lvl, cat, ex, exr, audio: true })),
  };
  indexLang(lang);
  return DB[lang];
}
function indexLang(lang = S.lang) {
  const db = DB[lang];
  if (!db) return;
  const custom = (LP(lang).custom || []).map((c) => ({ ...c, custom: true, audio: false, cat: c.cat || 'mine', lvl: c.lvl || '' }));
  db.words = [...custom, ...db.base];
  db.byId = new Map(db.words.map((w) => [w.id, w]));
  db.catMap = new Map([...db.cats, MINE].map((c) => [c.id, c]));
  db.orderKey = null;
}
const W = (id) => D()?.byId.get(id);
const catOf = (w) => D().catMap.get(w.cat) || MINE;

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

// Порядок подачи новых слов: свой уровень → уровни выше → уровни ниже,
// внутри уровня темы чередуются, чтобы день не состоял из одной темы.
function basePool() {
  const db = D(), lp = LP();
  const key = `${lp.level}|${lp.focus}`;
  if (db.orderKey === key) return db.order;
  const li = Math.max(0, LEVELS.indexOf(lp.level));
  const tier = (w) => { const i = LEVELS.indexOf(w.lvl); return i < 0 ? 5 : i >= li ? i - li : 10 + li - i; };
  const roundRobin = (list) => {
    const groups = new Map();
    for (const w of list) { if (!groups.has(w.cat)) groups.set(w.cat, []); groups.get(w.cat).push(w); }
    const arrays = [...groups.values()], out = [];
    for (let i = 0; out.length < list.length; i++) for (const g of arrays) if (g[i]) out.push(g[i]);
    return out;
  };
  const byTier = (list) => {
    const tiers = new Map();
    for (const w of list) { const t = tier(w); if (!tiers.has(t)) tiers.set(t, []); tiers.get(t).push(w); }
    return [...tiers.keys()].sort((a, b) => a - b).flatMap((t) => roundRobin(tiers.get(t)));
  };
  const focus = lp.focus ? db.base.filter((w) => w.cat === lp.focus) : [];
  const rest = lp.focus ? db.base.filter((w) => w.cat !== lp.focus) : db.base;
  db.order = [...byTier(focus), ...byTier(rest)].map((w) => w.id);
  db.orderKey = key;
  return db.order;
}
function newPool() {
  const custom = D().words.filter((w) => w.custom && status(w.id) === 'new').map((w) => w.id);
  return [...custom, ...basePool().filter((id) => status(id) === 'new')];
}

// ---------- план дня ----------
function plan() {
  const lp = LP(), t = today();
  if (!lp.plan || lp.plan.day !== t) {
    lp.plan = { day: t, ids: newPool().slice(0, lp.daily) };
    save();
  }
  lp.plan.ids = lp.plan.ids.filter((id) => W(id));
  return lp.plan;
}
const planLeft = () => plan().ids.filter((id) => status(id) === 'new');
function dueIds() {
  const t = today(), all = LP().words, out = [];
  for (const id in all) if (all[id].s >= 1 && all[id].due <= t && W(id)) out.push(id);
  return out.sort((a, b) => all[a].due - all[b].due);
}
function addToPlan(ids) {
  const p = plan();
  for (const id of ids) if (!p.ids.includes(id)) p.ids.push(id);
  save();
}

// ---------- интервальные повторения ----------
function introduce(id) {
  const r = rec(id, true);
  if (!r.s) { r.s = 1; r.due = today() + 1; r.first = today(); }
}
function grade(id, ok) {
  const r = rec(id, true), t = today();
  r.n = (r.n || 0) + 1;
  if (ok) {
    r.ok = (r.ok || 0) + 1;
    if (!r.s) introduce(id);
    else if (r.due <= t) { r.s = Math.min(INTERVALS.length - 1, r.s + 1); r.due = t + jitter(INTERVALS[r.s]); }
  } else {
    r.bad = (r.bad || 0) + 1;
    r.s = Math.max(1, (r.s || 1) - 2);
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

// ---------- звук ----------
let player = null;
function speak(w, example = false) {
  if (!w) return;
  const text = example ? w.ex : w.w;
  if (!text) return;
  if (player) { player.pause(); player = null; }
  speechSynthesis?.cancel();
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
function sfx(ok) {
  if (!S.settings.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = ok ? [660, 880] : [220, 180];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.09;
      o.type = ok ? 'sine' : 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    });
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

// варианты ответа: та же часть речи, по возможности та же тема, без одинаковых переводов
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

// ---------- роутинг ----------
const route = () => (location.hash.replace(/^#\/?/, '') || 'home').split('/');
const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };
window.addEventListener('hashchange', () => { closeSheet(); render(); window.scrollTo(0, 0); });

const app = $('#app');
let busy = false;

async function render() {
  if (!S.lang || !LP().level) return renderOnboarding();
  if (!D()) {
    if (busy) return;
    busy = true;
    app.innerHTML = `<div class="boot"><div class="boot-logo">d<span>Lang</span></div></div>`;
    try { await loadLang(S.lang); } catch (e) {
      app.innerHTML = `<div class="boot"><p>Не удалось загрузить слова 😕<br><small>${esc(e.message)}</small></p><button class="btn" onclick="location.reload()">Обновить</button></div>`;
      busy = false;
      return;
    }
    busy = false;
  }
  const [page, arg] = route();
  if (page === 'lesson') return lesson ? renderLesson() : go('#/home');
  if (page === 'cards' && cards) return renderCardSession();
  const view = { home: renderHome, words: () => renderWords(arg), cards: renderCards, profile: renderProfile }[page] || renderHome;
  app.innerHTML = `<main class="page page-${esc(page)}">${view()}</main>${nav(page)}`;
  afterRender[page]?.();
}
const afterRender = {};

function nav(page) {
  const items = [['home', 'Сегодня', ICON.home], ['words', 'Слова', ICON.book], ['cards', 'Карточки', ICON.cards], ['profile', 'Профиль', ICON.user]];
  return `<nav class="tabbar">${items.map(([id, label, icon]) =>
    `<a href="#/${id}" class="tab ${page === id || (id === 'home' && !['words', 'cards', 'profile'].includes(page)) ? 'on' : ''}">${icon}<span>${label}</span></a>`).join('')}</nav>`;
}

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19"/></svg>',
  cards: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="13" height="16" rx="2.5"/><path d="M4 7v11.5A2.5 2.5 0 0 0 6.5 21H15"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M5 9.5v5h3.5L13 19V5L8.5 9.5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
};
const playBtn = (id, cls = '', ex = false) => `<button class="play ${cls}" data-act="${ex ? 'say-ex' : 'say'}" data-id="${esc(id)}" aria-label="Послушать">${ICON.play}</button>`;

// ---------- онбординг ----------
const ob = { step: 0, lang: null };
function renderOnboarding() {
  const lang = ob.lang || S.lang;
  let body = '';
  if (!lang || ob.step === 0) {
    body = `
      <div class="ob-hero"><div class="logo">d<span>Lang</span></div>
        <h1>Учим слова по 10 минут в день</h1>
        <p>Карточки, квизы и повторения в нужный момент — слова остаются в голове.</p></div>
      <h2 class="ob-q">Что будем учить?</h2>
      <div class="ob-options">${Object.entries(LANGS).map(([id, l]) => `
        <button class="ob-option" data-act="ob-lang" data-lang="${id}">
          <span class="flag">${l.flag}</span><span><b>${l.name}</b><small>${id === 'en' ? '2000 главных слов' : '1000 главных слов'}</small></span>
        </button>`).join('')}</div>`;
  } else if (ob.step === 1) {
    body = `
      <button class="ob-back" data-act="ob-step" data-step="0">${ICON.back}</button>
      <h2 class="ob-q"><span class="flag">${LANGS[lang].flag}</span> Какой у тебя уровень?</h2>
      <p class="ob-sub">С него начнутся новые слова. Поменять можно в любой момент.</p>
      <div class="ob-options">${LANGS[lang].levels.map((lv) => `
        <button class="ob-option" data-act="ob-level" data-level="${lv}">
          <span class="lvl-badge lvl-${lv}">${lv}</span><span><b>${LEVEL_INFO[lv][0]}</b><small>${LEVEL_INFO[lv][1]}</small></span>
        </button>`).join('')}</div>`;
  } else {
    body = `
      <button class="ob-back" data-act="ob-step" data-step="1">${ICON.back}</button>
      <h2 class="ob-q">Сколько новых слов в день?</h2>
      <p class="ob-sub">Плюс повторения уже пройденных. 10 слов — примерно 10 минут.</p>
      <div class="ob-options grid">${DAILY_OPTIONS.map((n) => `
        <button class="ob-option center" data-act="ob-daily" data-n="${n}"><b class="big">${n}</b><small>${n <= 5 ? 'легко' : n <= 10 ? 'стандарт' : n <= 20 ? 'серьёзно' : 'интенсив'}</small></button>`).join('')}</div>`;
  }
  app.innerHTML = `<main class="onboarding">${body}</main>`;
}

// ---------- главная ----------
function ring(value, max, size = 132) {
  const r = size / 2 - 9, c = 2 * Math.PI * r, p = max ? clamp(value / max, 0, 1) : 0;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg ${p >= 1 ? 'done' : ''}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/>
  </svg>`;
}

function renderHome() {
  const lp = LP(), p = plan(), left = planLeft(), due = dueIds(), c = counts();
  const done = p.ids.length - left.length, streak = streakNow();
  let cta;
  if (left.length) cta = `<button class="btn btn-xl" data-act="lesson">Начать занятие</button>
      <p class="cta-sub">${Math.min(left.length, LESSON_NEW)} новых${due.length ? ` + ${Math.min(due.length, LESSON_REVIEW)} на повторение` : ''}</p>`;
  else if (due.length) cta = `<button class="btn btn-xl" data-act="lesson">Повторить ${words(due.length)}</button>
      <p class="cta-sub">Цель по новым словам выполнена 🎉</p>`;
  else cta = `<div class="done-badge">✨ На сегодня всё!</div>
      <button class="btn btn-ghost" data-act="more-words">Взять ещё 5 слов</button>`;

  const chips = p.ids.map((id) => {
    const w = W(id), st = status(id);
    return `<button class="chip-word st-${st}" data-act="word" data-id="${esc(id)}">${st !== 'new' ? '<i>✓</i>' : ''}${esc(w.w)}</button>`;
  }).join('');
  const focus = lp.focus && D().catMap.get(lp.focus);
  const pct = c.total ? Math.round((c.learned / c.total) * 100) : 0;

  return `
    <header class="topbar">
      <button class="lang-pill" data-act="lang-sheet"><span class="flag">${LANGS[S.lang].flag}</span>${LANGS[S.lang].name}<i>▾</i></button>
      <div class="top-stats">
        <span class="stat-pill ${streak ? 'fire' : ''}" title="Дней подряд">🔥 ${streak}</span>
        <span class="stat-pill" title="Очки сегодня">⚡ ${xpToday()}</span>
      </div>
    </header>

    <section class="hero card">
      <div class="hero-ring">${ring(done, p.ids.length)}<div class="ring-label"><b>${done}</b><span>из ${p.ids.length}</span></div></div>
      <div class="hero-main">
        <h1>${left.length ? 'Слова на сегодня' : due.length ? 'Время повторить' : 'Отличная работа'}</h1>
        <div class="hero-meta">
          <span><i class="dot st-new"></i>Новых: ${left.length}</span>
          <span><i class="dot st-learning"></i>Повторить: ${due.length}</span>
        </div>
        ${cta}
      </div>
    </section>

    ${p.ids.length ? `<section class="block">
      <div class="block-head"><h2>Слова дня</h2><button class="link" data-act="more-words">+5</button></div>
      <div class="chips">${chips}</div>
    </section>` : ''}

    <section class="quick">
      <button class="quick-card" data-act="go" data-to="#/cards"><span class="qi">🃏</span><b>Карточки</b><small>Листай и проверяй себя</small></button>
      <button class="quick-card" data-act="add-word"><span class="qi">➕</span><b>Своё слово</b><small>С переводом и ассоциацией</small></button>
    </section>

    <section class="card progress-card" data-act="go" data-to="#/words">
      <div class="block-head"><h2>Прогресс</h2><span class="muted">${pct}%</span></div>
      <div class="bar"><i class="bar-learned" style="width:${(c.learned / c.total) * 100}%"></i><i class="bar-learning" style="width:${(c.learning / c.total) * 100}%"></i></div>
      <div class="legend">
        <span><i class="dot st-learned"></i><b>${c.learned}</b> изучено</span>
        <span><i class="dot st-learning"></i><b>${c.learning}</b> изучаю</span>
        <span><i class="dot st-new"></i><b>${c.new}</b> впереди</span>
      </div>
    </section>

    <section class="card focus-card" data-act="focus-sheet">
      <span class="qi">${focus ? focus.emoji : '🎯'}</span>
      <div><small class="muted">Тема дня</small><b>${focus ? esc(focus.name) : 'Все темы вперемешку'}</b></div>
      <span class="lvl-badge lvl-${lp.level}">${lp.level}</span>
    </section>`;
}

// ---------- занятие ----------
let lesson = null;
let autoNext = null;

function startLesson(opts = {}) {
  const newIds = opts.newIds ?? planLeft().slice(0, LESSON_NEW);
  const rev = opts.reviewIds ?? shuffle(dueIds().slice(0, 60)).slice(0, newIds.length ? LESSON_REVIEW : LESSON_NEW + LESSON_REVIEW);
  if (!newIds.length && !rev.length) return toast('На сегодня всё повторено ✨');
  const steps = [], later = [];
  newIds.forEach((id, i) => {
    steps.push({ t: 'intro', id }, { t: 'choice', id });
    later.push({ t: i % 2 ? 'listen' : 'reverse', id });
  });
  for (const id of rev) later.push({ t: reviewType(id), id });
  steps.push(...shuffle(later));
  if (newIds.length >= 3) steps.push({ t: 'match', ids: newIds.slice() });
  lesson = { steps, i: 0, newIds, graded: new Set(), retries: {}, correct: 0, total: 0, xp: 0, combo: 0, best: 0, answered: null };
  go('#/lesson');
}
function reviewType(id) {
  const s = rec(id)?.s || 1;
  return pick(s <= 2 ? ['choice', 'reverse', 'listen'] : ['type', 'type', 'reverse', 'listen']);
}
const step = () => lesson.steps[lesson.i];

function renderLesson() {
  clearTimeout(autoNext);
  if (lesson.i >= lesson.steps.length) return renderLessonEnd();
  const st = step(), w = st.id && W(st.id);
  if (st.id && !w) { lesson.i++; return renderLesson(); }
  const progress = (lesson.i / lesson.steps.length) * 100;
  let body = '';
  if (st.t === 'intro') body = introView(w);
  else if (st.t === 'match') body = matchView(st);
  else if (st.t === 'type') body = typeView(w);
  else body = choiceView(st, w);
  app.innerHTML = `
    <main class="lesson">
      <header class="lesson-top">
        <button class="icon-btn" data-act="quit">${ICON.close}</button>
        <div class="lesson-bar"><i style="width:${progress}%"></i></div>
        <span class="combo ${lesson.combo >= 3 ? 'hot' : ''}">${lesson.combo >= 3 ? `🔥 ${lesson.combo}` : ''}</span>
      </header>
      <section class="lesson-body">${body}</section>
      ${feedbackView(st, w)}
    </main>`;
  const auto = S.settings.autoplay && !lesson.answered;
  if (st.t === 'intro' && S.settings.autoplay) speak(w);
  else if (st.t === 'listen' && !lesson.answered) speak(w);
  else if (st.t === 'choice' && auto) speak(w);
  if (st.t === 'type' && !lesson.answered) $('#typed')?.focus();
}

const POS_RU = { n: 'сущ.', v: 'глаг.', adj: 'прил.', adv: 'нареч.', prep: 'предлог', pron: 'местоим.', conj: 'союз', det: 'опред.', num: 'числ.', int: 'межд.', phr: 'фраза' };
function wordHead(w, { ipa = true, big = true } = {}) {
  const meta = [ipa && w.ipa ? esc(w.ipa) : '', POS_RU[w.pos] ? `<span class="pos">${POS_RU[w.pos]}</span>` : ''].filter(Boolean).join(' ');
  return `<div class="word-head ${big ? 'big' : ''}">
    <div class="word-line"><span class="word">${esc(w.w)}</span>${playBtn(w.id, 'lg')}</div>
    ${meta ? `<div class="ipa">${meta}</div>` : ''}
  </div>`;
}

function introView(w) {
  const r = rec(w.id), cat = catOf(w);
  return `
    <div class="ex-label"><span class="new-tag">Новое слово</span>${w.lvl ? `<span class="lvl-badge lvl-${w.lvl}">${w.lvl}</span>` : ''}<span class="muted">${cat.emoji} ${esc(cat.name)}</span></div>
    <div class="flash intro-card">
      ${wordHead(w)}
      <div class="translation">${esc(w.t)}</div>
      ${w.ex ? `<div class="example"><div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div>${playBtn(w.id, 'sm', true)}</div>` : ''}
      <label class="assoc">
        <span>${ICON.bulb} Ассоциация</span>
        <textarea data-assoc="${esc(w.id)}" rows="2" placeholder="Образ или созвучие, чтобы запомнить. Например: ${LANGS[S.lang].tip}">${esc(r?.as || '')}</textarea>
      </label>
    </div>
    <div class="intro-actions">
      <button class="btn btn-ghost" data-act="intro-known">Уже знаю</button>
      <button class="btn" data-act="intro-next">Запомнил →</button>
    </div>`;
}

function choiceView(st, w) {
  if (!st.opts) {
    const reverse = st.t !== 'choice';
    const field = reverse ? 'w' : 't';
    st.opts = shuffle([w, ...distractors(w, field)]).map((x) => x.id);
  }
  const reverse = st.t !== 'choice';
  let prompt;
  if (st.t === 'choice') prompt = `<div class="ex-label">Выбери перевод</div>${wordHead(w)}`;
  else if (st.t === 'reverse') prompt = `<div class="ex-label">Как это будет на ${S.lang === 'en' ? 'английском' : 'испанском'}?</div><div class="word-head big"><span class="word ru">${esc(w.t)}</span></div>`;
  else prompt = `<div class="ex-label">Что ты услышал?</div><button class="listen-big" data-act="say" data-id="${esc(w.id)}">${ICON.play}</button>`;
  const a = lesson.answered;
  return `${prompt}
    <div class="options">${st.opts.map((id, i) => {
      const x = W(id);
      let cls = '';
      if (a) cls = id === w.id ? 'right' : id === a.pick ? 'wrong' : 'dim';
      return `<button class="option ${cls}" data-act="pick" data-id="${esc(id)}" ${a ? 'disabled' : ''}><kbd>${i + 1}</kbd><span>${esc(reverse ? x.w : x.t)}</span></button>`;
    }).join('')}</div>`;
}

function typeView(w) {
  const a = lesson.answered;
  return `
    <div class="ex-label">Напиши на ${S.lang === 'en' ? 'английском' : 'испанском'}</div>
    <div class="word-head big"><span class="word ru">${esc(w.t)}</span></div>
    ${w.ex && !a ? `<p class="type-hint">${esc(w.exr || '')}</p>` : ''}
    <form class="type-form" data-form="type">
      <input id="typed" class="type-input ${a ? (a.ok ? 'right' : 'wrong') : ''}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
        lang="${S.lang}" placeholder="Твой ответ" value="${esc(a?.typed || '')}" ${a ? 'disabled' : ''}>
      ${a ? '' : `<div class="type-actions">
        <button type="button" class="btn btn-ghost" data-act="hint">Подсказка</button>
        <button class="btn">Проверить</button></div>`}
      ${S.lang === 'es' && !a ? `<div class="accents">${'áéíóúñü¿¡'.split('').map((ch) => `<button type="button" data-act="accent" data-ch="${ch}">${ch}</button>`).join('')}</div>` : ''}
    </form>`;
}

function matchView(st) {
  if (!st.left) {
    st.left = shuffle(st.ids.filter((id) => W(id)).slice());
    st.right = shuffle(st.left.slice());
    st.done = [];
    st.sel = null;
  }
  const col = (ids, side) => ids.map((id) => {
    const w = W(id), done = st.done.includes(id);
    return `<button class="match-item ${done ? 'matched' : ''} ${st.sel === id && side === 'l' ? 'sel' : ''}" data-act="match" data-side="${side}" data-id="${esc(id)}" ${done ? 'disabled' : ''}>${esc(side === 'l' ? w.w : w.t)}</button>`;
  }).join('');
  return `<div class="ex-label">Соедини пары</div>
    <div class="match"><div class="match-col">${col(st.left, 'l')}</div><div class="match-col">${col(st.right, 'r')}</div></div>`;
}

function feedbackView(st, w) {
  const a = lesson.answered;
  if (!a || !w) return '';
  const title = a.ok ? (a.note || pick(['Отлично!', 'Верно!', 'Так держать!', 'Супер!'])) : 'Правильный ответ:';
  return `<footer class="feedback ${a.ok ? 'ok' : 'bad'}">
    <div class="fb-text">
      <b>${title}</b>
      ${!a.ok || a.note ? `<div class="fb-answer">${esc(w.w)} — ${esc(w.t)} ${playBtn(w.id, 'sm')}</div>` : ''}
      ${!a.ok && w.ex ? `<small>${esc(w.ex)}</small>` : ''}
    </div>
    <button class="btn ${a.ok ? 'btn-ok' : 'btn-bad'}" data-act="next">Дальше</button>
  </footer>`;
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
  sfx(ok);
  renderLesson();
  if (ok && st.t !== 'listen') speak(W(id));
  if (ok && !extra.note) autoNext = setTimeout(nextStep, 1100);
}
function nextStep() {
  clearTimeout(autoNext);
  if (!lesson) return;
  lesson.answered = null;
  lesson.i++;
  renderLesson();
}
function renderLessonEnd() {
  if (!lesson.finished) {
    lesson.finished = true;
    lesson.xp += 5; addXP(5);
    bumpStreak();
    save();
    sfx(true);
  }
  const acc = lesson.total ? Math.round((lesson.correct / lesson.total) * 100) : 100;
  const more = planLeft().length || dueIds().length;
  app.innerHTML = `
    <main class="lesson-end">
      <div class="end-emoji">${acc >= 90 ? '🏆' : acc >= 70 ? '🎉' : '💪'}</div>
      <h1>${acc >= 90 ? 'Блестяще!' : acc >= 70 ? 'Занятие пройдено!' : 'Хорошая тренировка!'}</h1>
      <div class="end-stats">
        <div class="end-stat xp"><small>Очки</small><b>+${lesson.xp}</b></div>
        <div class="end-stat acc"><small>Точность</small><b>${acc}%</b></div>
        <div class="end-stat"><small>Новых слов</small><b>${lesson.newIds.filter((id) => status(id) !== 'new').length}</b></div>
      </div>
      <p class="muted">🔥 ${streakNow()} ${plural(streakNow(), 'день', 'дня', 'дней')} подряд${lesson.best >= 3 ? ` · лучшая серия ответов: ${lesson.best}` : ''}</p>
      <div class="end-actions">
        ${more ? '<button class="btn btn-xl" data-act="lesson">Следующее занятие</button>' : ''}
        <button class="btn btn-ghost" data-act="end-home">На главную</button>
      </div>
    </main>`;
}

// ---------- слова ----------
const wv = { q: '', seg: 'all', limit: 120 };
const SEGS = [['all', 'Все'], ['new', 'Новые'], ['learning', 'Изучаю'], ['learned', 'Изучено'], ['star', '⭐']];

function filterWords(cat) {
  const q = norm(wv.q), qa = stripAcc(q);
  return D().words.filter((w) => {
    if (cat && w.cat !== cat) return false;
    if (wv.seg === 'star') { if (!rec(w.id)?.st) return false; }
    else if (wv.seg !== 'all' && status(w.id) !== wv.seg) return false;
    if (q) return stripAcc(norm(w.w)).includes(qa) || norm(w.t).includes(q);
    return true;
  });
}
function wordRow(w) {
  const st = status(w.id), r = rec(w.id);
  return `<div class="word-row" data-act="word" data-id="${esc(w.id)}">
    <i class="dot st-${st}" title="${STATUS_NAME[st]}"></i>
    <div class="wr-main"><b>${esc(w.w)}${r?.st ? ' <span class="star-on">★</span>' : ''}${r?.as ? ' <span class="has-assoc" title="Есть ассоциация">💡</span>' : ''}</b><span>${esc(w.t)}</span></div>
    ${w.lvl ? `<span class="lvl-mini lvl-${w.lvl}">${w.lvl}</span>` : ''}
    ${playBtn(w.id, 'sm')}
  </div>`;
}
function listHTML(cat) {
  const list = filterWords(cat);
  if (!list.length) return `<div class="empty">${wv.q ? 'Ничего не нашлось' : wv.seg === 'star' ? 'Отмечай слова звёздочкой ⭐ — они соберутся здесь' : 'Пока пусто'}</div>`;
  return list.slice(0, wv.limit).map(wordRow).join('') +
    (list.length > wv.limit ? `<button class="btn btn-ghost wide" data-act="more-rows">Показать ещё (${list.length - wv.limit})</button>` : '');
}

function renderWords(cat) {
  const db = D();
  if (cat && !db.catMap.has(cat)) cat = null;
  const head = cat ? (() => {
    const c = db.catMap.get(cat), list = db.words.filter((w) => w.cat === cat), cn = counts(list);
    return `
      <header class="topbar"><button class="icon-btn" data-act="go" data-to="#/words">${ICON.back}</button><h1 class="title">${c.emoji} ${esc(c.name)}</h1><span></span></header>
      <section class="card cat-hero">
        <div class="bar"><i class="bar-learned" style="width:${cn.total ? (cn.learned / cn.total) * 100 : 0}%"></i><i class="bar-learning" style="width:${cn.total ? (cn.learning / cn.total) * 100 : 0}%"></i></div>
        <p class="muted">${cn.learned} из ${words(cn.total)} изучено</p>
        <div class="row-actions">
          <button class="btn" data-act="cards-cat" data-cat="${esc(cat)}">🃏 Карточки</button>
          ${cat !== 'mine' ? `<button class="btn btn-ghost" data-act="set-focus" data-cat="${esc(cat)}">${LP().focus === cat ? '✓ Тема дня' : '🎯 Сделать темой дня'}</button>` : `<button class="btn btn-ghost" data-act="add-word">➕ Добавить</button>`}
        </div>
      </section>`;
  })() : `<header class="topbar"><h1 class="title">Слова</h1><button class="icon-btn accent" data-act="add-word" aria-label="Добавить слово">${ICON.plus}</button></header>`;

  const showGrid = !cat && !wv.q && wv.seg === 'all';
  const tiles = showGrid ? (() => {
    const list = [...db.cats, MINE].map((c) => {
      const ws = db.words.filter((w) => w.cat === c.id);
      if (!ws.length && c.id !== 'mine') return '';
      const cn = counts(ws);
      return `<button class="tile" data-act="go" data-to="#/words/${c.id}">
        <span class="tile-emoji">${c.emoji}</span><b>${esc(c.name)}</b>
        <small>${cn.learned}/${cn.total}</small>
        <span class="tile-bar"><i style="width:${cn.total ? (cn.learned / cn.total) * 100 : 0}%"></i></span>
      </button>`;
    }).join('');
    return `<div class="tiles">${list}</div>`;
  })() : '';

  return `${head}
    <div class="search"><span>${ICON.search}</span><input id="wsearch" type="search" placeholder="Поиск по словам и переводам" value="${esc(wv.q)}"></div>
    <div class="segs">${SEGS.map(([id, label]) => `<button class="seg ${wv.seg === id ? 'on' : ''}" data-act="seg" data-seg="${id}">${label}</button>`).join('')}</div>
    ${tiles}
    <div id="wlist" class="word-list ${showGrid ? 'hidden' : ''}">${showGrid ? '' : listHTML(cat)}</div>`;
}
afterRender.words = () => {
  const input = $('#wsearch');
  if (!input) return;
  if (wv.focus) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); wv.focus = false; }
  input.addEventListener('input', () => {
    wv.q = input.value; wv.limit = 120;
    const [, cat] = route();
    if (!cat && wv.seg === 'all') { wv.focus = true; return render(); }
    $('#wlist').innerHTML = listHTML(cat);
  });
};

// ---------- карточки ----------
let cards = null;
let cardDir = 'front'; // front: слово → перевод, back: перевод → слово

function cardSets() {
  const db = D(), all = LP().words;
  const by = (fn) => db.words.filter(fn).map((w) => w.id);
  return [
    ['due', '🔁', 'Повторить сегодня', dueIds()],
    ['plan', '📅', 'Слова дня', plan().ids.slice()],
    ['learning', '🌱', 'Изучаю', by((w) => status(w.id) === 'learning')],
    ['learned', '✅', 'Изучено', by((w) => status(w.id) === 'learned')],
    ['star', '⭐', 'Избранное', by((w) => all[w.id]?.st)],
    ['sift', '🔎', 'Проверь, что уже знаешь', newPool().slice(0, 40)],
  ];
}
function renderCards() {
  const sets = cardSets();
  const cats = [...D().cats, MINE].map((c) => [c, D().words.filter((w) => w.cat === c.id).length]).filter(([, n]) => n);
  return `
    <header class="topbar"><h1 class="title">Карточки</h1>
      <div class="dir-toggle">
        <button class="${cardDir === 'front' ? 'on' : ''}" data-act="dir" data-dir="front">${S.lang.toUpperCase()} → RU</button>
        <button class="${cardDir === 'back' ? 'on' : ''}" data-act="dir" data-dir="back">RU → ${S.lang.toUpperCase()}</button>
      </div></header>
    <div class="set-list">${sets.map(([id, emoji, name, ids]) => `
      <button class="set ${ids.length ? '' : 'off'}" data-act="cards-set" data-set="${id}" ${ids.length ? '' : 'disabled'}>
        <span class="qi">${emoji}</span><span><b>${name}</b><small>${id === 'sift' ? 'Свайп вправо — знаю, слово уйдёт из плана' : words(ids.length)}</small></span><i>›</i>
      </button>`).join('')}</div>
    <h2 class="section-title">По темам</h2>
    <div class="tiles small">${cats.map(([c, n]) => `
      <button class="tile" data-act="cards-cat" data-cat="${c.id}"><span class="tile-emoji">${c.emoji}</span><b>${esc(c.name)}</b><small>${n}</small></button>`).join('')}</div>`;
}
function startCards(ids, title, kind) {
  if (!ids.length) return toast('Здесь пока нет слов');
  const list = kind === 'sift' ? ids.slice(0, 40) : shuffle(ids.slice()).slice(0, 30);
  cards = { ids: list, i: 0, flipped: false, know: [], again: [], title, kind };
  go('#/cards');
}
function renderCardSession() {
  const c = cards;
  if (c.i >= c.ids.length) {
    app.innerHTML = `
      <main class="lesson-end">
        <div class="end-emoji">🃏</div><h1>Колода пройдена</h1>
        <div class="end-stats">
          <div class="end-stat acc"><small>Знаю</small><b>${c.know.length}</b></div>
          <div class="end-stat xp"><small>Повторить</small><b>${c.again.length}</b></div>
        </div>
        <div class="end-actions">
          ${c.again.length ? '<button class="btn btn-xl" data-act="cards-again">Повторить незнакомые</button>' : ''}
          <button class="btn btn-ghost" data-act="cards-exit">К колодам</button>
        </div>
      </main>`;
    return;
  }
  const w = W(c.ids[c.i]), r = rec(w.id);
  const front = cardDir === 'front'
    ? `${wordHead(w)}`
    : `<div class="word-head big"><span class="word ru">${esc(w.t)}</span></div>`;
  const back = `
    ${cardDir === 'front' ? `<div class="back-word">${esc(w.w)} ${playBtn(w.id, 'sm')}</div><div class="translation">${esc(w.t)}</div>` : wordHead(w)}
    ${w.ex ? `<div class="example"><div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div>${playBtn(w.id, 'sm', true)}</div>` : ''}
    ${r?.as ? `<div class="assoc-view">${ICON.bulb}<span>${esc(r.as)}</span></div>` : ''}`;
  app.innerHTML = `
    <main class="lesson cards-session">
      <header class="lesson-top">
        <button class="icon-btn" data-act="cards-exit">${ICON.close}</button>
        <div class="lesson-bar"><i style="width:${(c.i / c.ids.length) * 100}%"></i></div>
        <span class="counter">${c.i + 1}/${c.ids.length}</span>
      </header>
      <section class="deck">
        <div class="swipe-hint left">Ещё раз</div><div class="swipe-hint right">Знаю</div>
        <div class="fcard ${c.flipped ? 'flipped' : ''}" id="fcard">
          <div class="fface front">${front}<p class="tap-hint">Нажми, чтобы перевернуть</p></div>
          <div class="fface back">${back}</div>
        </div>
      </section>
      <footer class="card-actions">
        <button class="btn btn-bad-soft" data-act="card-grade" data-ok="0">✕ ${c.kind === 'sift' ? 'Не знаю' : 'Ещё раз'}</button>
        <button class="btn btn-ok-soft" data-act="card-grade" data-ok="1">✓ Знаю</button>
      </footer>
    </main>`;
  if (S.settings.autoplay && cardDir === 'front') speak(w);
  bindSwipe($('#fcard'));
}
function gradeCard(ok) {
  const c = cards, id = c.ids[c.i], st = status(id);
  (ok ? c.know : c.again).push(id);
  if (c.kind === 'sift') { if (ok) markKnown(id); }
  else if (st === 'new') { if (ok) markKnown(id); }
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
      if (!moved) { cards.flipped = !cards.flipped; el.classList.toggle('flipped', cards.flipped); if (cards.flipped && cardDir === 'back') speak(W(cards.ids[cards.i])); }
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

// ---------- профиль ----------
function renderProfile() {
  const lp = LP(), c = counts();
  const t = today();
  const days = Array.from({ length: 14 }, (_, i) => t - 13 + i);
  const maxXp = Math.max(10, ...days.map((d) => S.xp[dayKey(d)] || 0));
  const totalXp = Object.values(S.xp).reduce((a, b) => a + b, 0);
  const byLevel = LEVELS.map((lv) => { const ws = D().base.filter((w) => w.lvl === lv); return [lv, counts(ws)]; }).filter(([, cn]) => cn.total);
  return `
    <header class="topbar"><h1 class="title">Профиль</h1><span></span></header>
    <section class="stats-grid">
      <div class="card stat"><b>🔥 ${streakNow()}</b><small>дней подряд · рекорд ${S.streak.best || 0}</small></div>
      <div class="card stat"><b>⚡ ${totalXp}</b><small>очков всего</small></div>
      <div class="card stat"><b>${c.learned}</b><small>изучено слов</small></div>
      <div class="card stat"><b>${c.learning}</b><small>в процессе</small></div>
    </section>
    <section class="card">
      <div class="block-head"><h2>Активность</h2><span class="muted">14 дней</span></div>
      <div class="activity">${days.map((d) => { const v = S.xp[dayKey(d)] || 0; return `<div class="act-col" title="${dayKey(d)}: ${v} очков"><i style="height:${Math.max(4, (v / maxXp) * 100)}%" class="${v ? 'on' : ''}"></i><small>${new Date(d * 864e5).getUTCDate()}</small></div>`; }).join('')}</div>
    </section>
    <section class="card">
      <div class="block-head"><h2>По уровням</h2></div>
      ${byLevel.map(([lv, cn]) => `<div class="lvl-row"><span class="lvl-badge lvl-${lv}">${lv}</span>
        <div class="bar thin"><i class="bar-learned" style="width:${(cn.learned / cn.total) * 100}%"></i><i class="bar-learning" style="width:${(cn.learning / cn.total) * 100}%"></i></div>
        <small>${cn.learned}/${cn.total}</small></div>`).join('')}
    </section>

    <h2 class="section-title">Язык</h2>
    <div class="lang-cards">${Object.entries(LANGS).map(([id, l]) => `
      <button class="lang-card ${S.lang === id ? 'on' : ''}" data-act="switch-lang" data-lang="${id}">
        <span class="flag">${l.flag}</span><b>${l.name}</b><small>${S.langs[id]?.level ? `уровень ${S.langs[id].level}` : 'начать'}</small>
      </button>`).join('')}</div>

    <h2 class="section-title">Настройки · ${LANGS[S.lang].name}</h2>
    <section class="card settings">
      <div class="set-row col"><span>Уровень новых слов</span>
        <div class="segs inline">${LANGS[S.lang].levels.map((lv) => `<button class="seg ${lp.level === lv ? 'on' : ''}" data-act="set-level" data-level="${lv}">${lv} · ${LEVEL_INFO[lv][0]}</button>`).join('')}</div></div>
      <div class="set-row col"><span>Новых слов в день</span>
        <div class="segs inline">${DAILY_OPTIONS.map((n) => `<button class="seg ${lp.daily === n ? 'on' : ''}" data-act="set-daily" data-n="${n}">${n}</button>`).join('')}</div></div>
      <button class="set-row" data-act="focus-sheet"><span>Тема дня</span><b>${lp.focus ? esc(D().catMap.get(lp.focus)?.name || '') : 'Все темы'} ›</b></button>
    </section>
    <h2 class="section-title">Общие</h2>
    <section class="card settings">
      ${toggleRow('autoplay', 'Автоматически произносить слова')}
      ${toggleRow('slow', 'Медленное произношение')}
      ${toggleRow('sound', 'Звуки ответов')}
    </section>
    <h2 class="section-title">Данные</h2>
    <section class="card settings">
      <button class="set-row" data-act="import-old"><span>📥 Перенести изученные слова со старого сайта</span><b>›</b></button>
      <button class="set-row" data-act="export"><span>💾 Сохранить прогресс в файл</span><b>›</b></button>
      <label class="set-row"><span>📂 Загрузить прогресс из файла</span><b>›</b><input type="file" accept="application/json" id="import-file" hidden></label>
      <button class="set-row danger" data-act="reset-lang"><span>Сбросить прогресс · ${LANGS[S.lang].name}</span><b>›</b></button>
    </section>
    <p class="foot muted">dLang · озвучка нейроголосами Microsoft · прогресс хранится в этом браузере</p>`;
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
      toast('Прогресс загружен ✓');
      render();
    } catch { toast('Это не файл прогресса dLang'); }
  });
};

// ---------- шторки ----------
const sheetRoot = $('#sheet-root');
function openSheet(html, cls = '') {
  sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet ${cls}" role="dialog"><div class="sheet-grip"></div>${html}</div>`;
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
  const r = rec(id), st = status(id), cat = catOf(w);
  const inPlan = plan().ids.includes(id);
  openSheet(`
    <div class="ws">
      <div class="ws-top"><span class="status-chip st-${st}">${STATUS_NAME[st]}</span>${w.lvl ? `<span class="lvl-badge lvl-${w.lvl}">${w.lvl}</span>` : ''}<span class="muted">${cat.emoji} ${esc(cat.name)}</span>
        <button class="icon-btn star ${r?.st ? 'on' : ''}" data-act="star" data-id="${esc(id)}" aria-label="В избранное">${ICON.star}</button></div>
      ${wordHead(w)}
      <div class="translation">${esc(w.t)}</div>
      ${w.ex ? `<div class="example"><div><p>${esc(w.ex)}</p>${w.exr ? `<small>${esc(w.exr)}</small>` : ''}</div>${playBtn(w.id, 'sm', true)}</div>` : ''}
      <label class="assoc"><span>${ICON.bulb} Моя ассоциация</span>
        <textarea data-assoc="${esc(id)}" rows="3" placeholder="Картинка в голове, созвучие, история — всё, что поможет вспомнить">${esc(r?.as || '')}</textarea></label>
      ${r?.n ? `<p class="muted small">Ответов: ${r.ok || 0} верно · ${r.bad || 0} с ошибкой${r.s ? ` · следующее повторение ${r.due <= today() ? 'сегодня' : `через ${words(r.due - today()).replace(/слов.*/, '')}${plural(r.due - today(), 'день', 'дня', 'дней')}`}` : ''}</p>` : ''}
      <div class="ws-actions">
        ${st === 'new' ? `<button class="btn" data-act="learn-today" data-id="${esc(id)}" ${inPlan ? 'disabled' : ''}>${inPlan ? '✓ В плане на сегодня' : '📅 Учить сегодня'}</button>` : ''}
        ${st !== 'learned' ? `<button class="btn btn-ghost" data-act="know" data-id="${esc(id)}">✓ Я знаю это слово</button>` : `<button class="btn btn-ghost" data-act="reset-word" data-id="${esc(id)}">↺ Учить заново</button>`}
        ${w.custom ? `<button class="btn btn-ghost" data-act="edit-word" data-id="${esc(id)}">✎ Изменить</button>` : ''}
      </div>
    </div>`);
}

function wordForm(id) {
  const w = id ? W(id) : null;
  const r = id ? rec(id) : null;
  const cats = [MINE, ...D().cats];
  openSheet(`
    <form class="form" data-form="word" data-id="${esc(id || '')}">
      <h2>${w ? 'Изменить слово' : 'Новое слово'} <span class="flag">${LANGS[S.lang].flag}</span></h2>
      <label><span>Слово на ${S.lang === 'en' ? 'английском' : 'испанском'}</span><input name="w" required value="${esc(w?.w || '')}" autocomplete="off" lang="${S.lang}" placeholder="${S.lang === 'en' ? 'serendipity' : 'la sobremesa'}"></label>
      <label><span>Перевод</span><input name="t" required value="${esc(w?.t || '')}" autocomplete="off" placeholder="${S.lang === 'en' ? 'счастливая случайность' : 'беседа за столом после еды'}"></label>
      <label><span>Пример <small>(необязательно)</small></span><input name="ex" value="${esc(w?.ex || '')}" autocomplete="off" lang="${S.lang}"></label>
      <label><span>Перевод примера <small>(необязательно)</small></span><input name="exr" value="${esc(w?.exr || '')}" autocomplete="off"></label>
      <label><span>${ICON.bulb} Ассоциация <small>(необязательно)</small></span><textarea name="as" rows="2">${esc(r?.as || '')}</textarea></label>
      <label><span>Тема</span><select name="cat">${cats.map((c) => `<option value="${c.id}" ${(w?.cat || 'mine') === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></label>
      ${w ? '' : '<label class="check"><input type="checkbox" name="today" checked> Учить уже сегодня</label>'}
      <div class="form-actions">
        ${w ? `<button type="button" class="btn btn-ghost danger" data-act="delete-word" data-id="${esc(id)}">Удалить</button>` : ''}
        <button class="btn">${w ? 'Сохранить' : 'Добавить'}</button>
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
  if (i < 0 && f.get('today')) addToPlan([id]);
  save();
  closeSheet();
  toast(i >= 0 ? 'Сохранено ✓' : 'Слово добавлено ✓');
  render();
}

function langSheet() {
  openSheet(`<h2>Язык</h2><div class="ob-options">${Object.entries(LANGS).map(([id, l]) => {
    const lp = S.langs[id];
    const learned = lp ? Object.values(lp.words).filter((r) => r.s >= LEARNED).length : 0;
    return `<button class="ob-option ${S.lang === id ? 'on' : ''}" data-act="switch-lang" data-lang="${id}">
      <span class="flag">${l.flag}</span><span><b>${l.name}</b><small>${lp?.level ? `${learned} изучено · уровень ${lp.level}` : 'Начать с нуля'}</small></span>${S.lang === id ? '<i class="check-on">✓</i>' : ''}</button>`;
  }).join('')}</div>`);
}
function focusSheet() {
  const lp = LP();
  openSheet(`<h2>Тема дня</h2><p class="muted">Новые слова сначала будут из этой темы.</p>
    <div class="focus-list">
      <button class="focus-item ${!lp.focus ? 'on' : ''}" data-act="set-focus" data-cat="">🎲 <b>Все темы вперемешку</b></button>
      ${D().cats.map((c) => { const cn = counts(D().words.filter((w) => w.cat === c.id)); return `<button class="focus-item ${lp.focus === c.id ? 'on' : ''}" data-act="set-focus" data-cat="${c.id}">${c.emoji} <b>${esc(c.name)}</b><small>${cn.learned}/${cn.total}</small></button>`; }).join('')}
    </div>`);
}

// ---------- перенос со старого сайта ----------
const SNIPPET = `(async()=>{const o={ls:{},ss:{},idb:{}};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o.ls[k]=localStorage.getItem(k)}for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);o.ss[k]=sessionStorage.getItem(k)}try{for(const d of await indexedDB.databases()){const db=await new Promise((r,j)=>{const q=indexedDB.open(d.name);q.onsuccess=()=>r(q.result);q.onerror=j});o.idb[d.name]={};for(const s of db.objectStoreNames){o.idb[d.name][s]=await new Promise(r=>{const q=db.transaction(s).objectStore(s).getAll();q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)})}}}catch(e){}const t=JSON.stringify(o);try{copy(t);console.log('✅ Скопировано ('+t.length+' символов). Вернись в dLang и нажми «Вставить».')}catch(e){console.log(t)}})()`;

function importSheet() {
  openSheet(`
    <h2>Перенос со старого сайта</h2>
    <ol class="steps">
      <li>Открой <a href="${OLD_SITE}" target="_blank" rel="noopener">старый сайт</a> в Chrome на компьютере.</li>
      <li>Нажми <kbd>F12</kbd> → вкладка <b>Console</b>.</li>
      <li>Скопируй команду и вставь её в консоль, нажми <kbd>Enter</kbd>. Если Chrome попросит, сначала напиши <code>allow pasting</code>.</li>
      <li>Вернись сюда и нажми «Вставить».</li>
    </ol>
    <button class="btn btn-ghost wide" data-act="copy-snippet">📋 Скопировать команду</button>
    <textarea id="import-text" class="import-text" rows="4" placeholder="Сюда вставится прогресс. Можно вставить и просто список слов — по одному в строке."></textarea>
    <div class="form-actions"><button class="btn btn-ghost" data-act="paste-import">Вставить</button><button class="btn" data-act="run-import">Найти слова</button></div>
    <div id="import-result"></div>`);
}

const LEARN_RX = /learn|known|know|master|done|studied|complete|memori|remember|изуч|выуч|знаю|запомн/i;
const NOT_RX = /unlearn|not.?learn|unknown|not.?known|^new|todo|queue|wrong|неизуч|не.?изуч|ignore/i;
const WORDY = /^[a-záéíóúñü][a-záéíóúñü' -]{0,39}$/i;
const wordOf = (o) => [o.word, o.en, o.english, o.term, o.w, o.front, o.text, o.es, o.spanish, o.original].find((x) => typeof x === 'string' && WORDY.test(x.trim()));
const trOf = (o) => [o.ru, o.translation, o.tr, o.t, o.back, o.meaning, o.russian, o.translate, o.rus].find((x) => typeof x === 'string' && /[а-яё]/i.test(x)) || '';
const learnedVal = (x) => x === true || x === 1 || (typeof x === 'string' && LEARN_RX.test(x) && !NOT_RX.test(x)) || (x && typeof x === 'object' && !Array.isArray(x) && learnedObj(x));
function learnedObj(o) {
  if (o.learned === true || o.known === true || o.mastered === true || o.isLearned === true || o.isKnown === true || o.done === true) return true;
  const s = String(o.status ?? o.state ?? '');
  return !!s && LEARN_RX.test(s) && !NOT_RX.test(s);
}

function harvest(text) {
  const found = new Map(), ids = [];
  const add = (w, t = '') => { const k = w.trim(); if (k && !found.has(k.toLowerCase())) found.set(k.toLowerCase(), { w: k, t }); };
  const visit = (v, path, depth) => {
    if (v == null || depth > 14) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if ((s[0] === '{' || s[0] === '[') && s.length > 1) { try { visit(JSON.parse(s), path, depth + 1); } catch {} }
      return;
    }
    const last = path.split('.').pop() || '';
    const learnPath = LEARN_RX.test(path) && !NOT_RX.test(last);
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string') { if (learnPath && WORDY.test(x.trim())) add(x); else visit(x, path, depth + 1); }
        else if (typeof x === 'number') { if (learnPath) ids.push(x); }
        else if (x && typeof x === 'object') {
          const w = wordOf(x);
          if (w && (learnPath || learnedObj(x))) add(w, trOf(x)); else visit(x, path, depth + 1);
        }
      }
      return;
    }
    if (typeof v === 'object') {
      const w = wordOf(v);
      if (w && learnedObj(v)) return add(w, trOf(v));
      const entries = Object.entries(v);
      const mapLike = learnPath || entries.filter(([k, x]) => WORDY.test(k) && learnedVal(x)).length >= 10;
      for (const [k, x] of entries) {
        if (WORDY.test(k) && !LEARN_RX.test(k)) {
          // {word: {status: 'learned'}} — надёжный признак; {word: true} — только внутри «изученного» раздела
          if (x && typeof x === 'object' && !Array.isArray(x) && learnedObj(x)) { add(k, trOf(x)); continue; }
          if (mapLike && learnedVal(x)) { add(k, ''); continue; }
        }
        visit(x, path + '.' + k, depth + 1);
      }
    }
  };
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (json !== null && typeof json === 'object') visit(json, '', 0);
  else {
    for (const line of text.split(/\r?\n/)) {
      const m = line.trim().match(/^([A-Za-zÁÉÍÓÚÑÜáéíóúñü][A-Za-zÁÉÍÓÚÑÜáéíóúñü' -]*)(?:\s*[—–\-:\t=]\s*(.+))?$/);
      if (m) add(m[1].trim(), m[2] && /[а-яё]/i.test(m[2]) ? m[2].trim() : '');
    }
  }
  return { found: [...found.values()], ids };
}

let importFound = null;
function runImport() {
  const text = $('#import-text').value.trim();
  const out = $('#import-result');
  if (!text) return toast('Сначала вставь текст');
  const { found, ids } = harvest(text);
  const keyOf = (s) => stripAcc(norm(s)).replace(/^(to|el|la|los|las|un|una) /, '');
  const index = new Map();
  for (const w of D().words) for (const a of answers(w)) index.set(stripAcc(a), w.id);
  const matched = new Set(), extra = [];
  for (const f of found) {
    const id = index.get(keyOf(f.w)) || index.get(stripAcc(norm(f.w)));
    if (id) matched.add(id); else extra.push(f);
  }
  const extraWithTr = extra.filter((f) => f.t);
  importFound = { matched: [...matched], extra: extraWithTr };
  if (!found.length) {
    out.innerHTML = `<div class="import-box warn">Не нашёл изученных слов${ids.length ? ` — прогресс хранится номерами (${ids.length} шт.). Пришли этот текст в чат Claude, переведу вручную.` : '. Проверь, что команда выполнилась на странице старого сайта, или пришли текст в чат Claude.'}</div>`;
    return;
  }
  out.innerHTML = `<div class="import-box">
    <p>Найдено слов: <b>${found.length}</b></p>
    <p>✅ Есть в словаре dLang: <b>${matched.size}</b> — отмечу изученными</p>
    ${extraWithTr.length ? `<label class="check"><input type="checkbox" id="import-extra" checked> Добавить ещё ${words(extraWithTr.length)} в «Мои слова» как изученные</label>` : ''}
    ${extra.length - extraWithTr.length ? `<p class="muted small">${extra.length - extraWithTr.length} без перевода и не из словаря — пропущу</p>` : ''}
    <button class="btn wide" data-act="apply-import">Перенести</button></div>`;
}
function applyImport() {
  if (!importFound) return;
  let n = 0;
  for (const id of importFound.matched) if (status(id) !== 'learned') { markKnown(id); n++; }
  if ($('#import-extra')?.checked) {
    const lp = LP();
    const have = new Set(lp.custom.map((c) => norm(c.w)));
    for (const f of importFound.extra) {
      if (have.has(norm(f.w))) continue;
      const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      lp.custom.push({ id, w: f.w, t: f.t, ex: '', exr: '', cat: 'mine', ipa: '', pos: '', lvl: '' });
      markKnown(id); n++;
    }
    indexLang();
  }
  D().orderKey = null;
  LP().plan.day = -1; // пересобрать план дня без уже известных слов
  save();
  closeSheet();
  toast(`Перенесено: ${words(n)} ✓`);
  render();
}

// ---------- экспорт ----------
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- события ----------
async function switchLang(lang) {
  closeSheet();
  if (!S.langs[lang]?.level) { ob.lang = lang; ob.step = 1; S.lang = lang; LP(lang); return renderOnboarding(); }
  S.lang = lang;
  save();
  try { await loadLang(lang); } catch {}
  go('#/home');
}

const actions = {
  'ob-lang': (el) => { ob.lang = el.dataset.lang; S.lang = ob.lang; LP(); ob.step = 1; renderOnboarding(); },
  'ob-step': (el) => { ob.step = +el.dataset.step; renderOnboarding(); },
  'ob-level': (el) => { ob.level = el.dataset.level; ob.step = 2; renderOnboarding(); },
  'ob-daily': (el) => {
    const lp = LP(ob.lang || S.lang);
    lp.level = ob.level || 'A1';
    lp.daily = +el.dataset.n;
    lp.plan = { day: -1, ids: [] };
    S.lang = ob.lang || S.lang;
    ob.step = 0;
    save();
    go('#/home');
  },
  go: (el) => go(el.dataset.to),
  say: (el) => speak(W(el.dataset.id)),
  'say-ex': (el) => speak(W(el.dataset.id), true),
  lesson: () => startLesson(),
  'more-words': () => { const p = plan(); const extra = newPool().filter((id) => !p.ids.includes(id)).slice(0, 5); addToPlan(extra); toast(`+${words(extra.length)} на сегодня`); render(); },
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
  'focus-sheet': focusSheet,
  'switch-lang': (el) => switchLang(el.dataset.lang),
  'set-focus': (el) => { LP().focus = el.dataset.cat || null; D().orderKey = null; refreshPlan(); save(); closeSheet(); toast('Тема дня обновлена'); render(); },
  'set-level': (el) => { LP().level = el.dataset.level; D().orderKey = null; refreshPlan(); save(); render(); },
  'set-daily': (el) => { LP().daily = +el.dataset.n; refreshPlan(); save(); render(); },
  toggle: (el) => { S.settings[el.dataset.key] = !S.settings[el.dataset.key]; save(); render(); },
  'close-sheet': closeSheet,
  star: (el) => { const r = rec(el.dataset.id, true); r.st = !r.st; save(); el.classList.toggle('on', r.st); },
  'learn-today': (el) => { addToPlan([el.dataset.id]); toast('Добавлено в план на сегодня'); closeSheet(); render(); },
  know: (el) => { markKnown(el.dataset.id); save(); closeSheet(); toast('Отмечено как изученное ✓'); render(); },
  'reset-word': (el) => { resetWord(el.dataset.id); save(); closeSheet(); toast('Слово вернётся в новые'); render(); },
  seg: (el) => { wv.seg = el.dataset.seg; wv.limit = 120; render(); },
  'more-rows': () => { wv.limit += 200; const [, cat] = route(); $('#wlist').innerHTML = listHTML(cat); },
  dir: (el) => { cardDir = el.dataset.dir; render(); },
  'cards-set': (el) => { const s = cardSets().find((x) => x[0] === el.dataset.set); startCards(s[3], s[2], s[0]); },
  'cards-cat': (el) => startCards(D().words.filter((w) => w.cat === el.dataset.cat).map((w) => w.id), '', 'cat'),
  'card-grade': (el) => gradeCard(el.dataset.ok === '1'),
  'cards-again': () => startCards(cards.again, cards.title, 'again'),
  'cards-exit': () => { cards = null; go('#/cards'); },
  quit: () => { if (lesson.total && !confirm('Закончить занятие? Пройденное сохранится.')) return; lesson = null; go('#/home'); },
  'end-home': () => { lesson = null; go('#/home'); },
  'intro-next': () => { introduce(step().id); lesson.xp += 3; addXP(3); save(); nextStep(); },
  'intro-known': () => {
    const id = step().id;
    markKnown(id);
    lesson.steps = lesson.steps.filter((s, i) => i <= lesson.i || s.id !== id).map((s) => (s.t === 'match' ? { ...s, ids: s.ids.filter((x) => x !== id) } : s))
      .filter((s) => s.t !== 'match' || s.ids.length >= 3);
    lesson.newIds = lesson.newIds.filter((x) => x !== id);
    save();
    nextStep();
  },
  pick: (el) => { if (lesson.answered) return; const w = W(step().id); answer(el.dataset.id === w.id, { pick: el.dataset.id }); },
  next: () => nextStep(),
  hint: () => {
    const w = W(step().id), input = $('#typed');
    const target = w.w;
    const cur = input.value;
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
      st.done.push(id); st.sel = null; sfx(true);
      if (st.done.length >= st.left.length) { lesson.xp += 5; addXP(5); save(); setTimeout(nextStep, 450); }
      renderLesson();
    } else {
      sfx(false);
      el.classList.add('shake');
      setTimeout(() => el.classList.remove('shake'), 400);
    }
  },
  'import-old': importSheet,
  'copy-snippet': async () => { try { await navigator.clipboard.writeText(SNIPPET); toast('Команда скопирована'); } catch { prompt('Скопируй команду:', SNIPPET); } },
  'paste-import': async () => { try { $('#import-text').value = await navigator.clipboard.readText(); runImport(); } catch { toast('Вставь вручную: Ctrl+V'); $('#import-text').focus(); } },
  'run-import': runImport,
  'apply-import': applyImport,
  export: exportProgress,
  'reset-lang': () => {
    if (!confirm(`Стереть весь прогресс по языку «${LANGS[S.lang].name}»? Свои слова тоже удалятся.`)) return;
    delete S.langs[S.lang];
    DB[S.lang] && (DB[S.lang].orderKey = null);
    save();
    renderOnboarding();
  },
};
function refreshPlan() {
  // оставить уже пройденные сегодня слова, остальное добрать по новым настройкам
  const lp = LP(), p = plan();
  const started = p.ids.filter((id) => status(id) !== 'new' || W(id)?.custom);
  lp.plan = { day: today(), ids: [...started, ...newPool().filter((id) => !started.includes(id)).slice(0, Math.max(0, lp.daily - started.length))] };
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  if (el.closest('.play, .listen-big, .star')) e.stopPropagation();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'word') return saveWordForm(form);
  if (form.dataset.form === 'type' && lesson && !lesson.answered) {
    const w = W(step().id), typed = $('#typed').value, res = checkTyped(typed, w);
    if (res === 'empty') return;
    const note = res === 'accent' ? 'Почти! Обрати внимание на ударение' : res === 'typo' ? 'Почти! Небольшая опечатка' : '';
    answer(res !== 'wrong', { typed, note });
  }
});

let assocTimer = null;
document.addEventListener('input', (e) => {
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
    if (!st) return;
    if (e.key === 'Enter' && !typing) {
      e.preventDefault();
      if (lesson.answered) return nextStep();
      if (st.t === 'intro') return actions['intro-next']();
      if (lesson.i >= lesson.steps.length) return;
    }
    if (e.key === 'Enter' && typing && lesson.answered) { e.preventDefault(); return nextStep(); }
    if (!typing && !lesson.answered && /^[1-4]$/.test(e.key)) $$('.option')[+e.key - 1]?.click();
    if (!typing && e.key === ' ' && st.id) { e.preventDefault(); speak(W(st.id)); }
  } else if (cards && route()[0] === 'cards' && !typing) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); const el = $('#fcard'); if (el) { cards.flipped = !cards.flipped; el.classList.toggle('flipped', cards.flipped); } }
    if (e.key === 'ArrowRight') gradeCard(true);
    if (e.key === 'ArrowLeft') gradeCard(false);
  }
});
const $$ = (sel) => [...document.querySelectorAll(sel)];

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
speechSynthesis?.getVoices();
window.dlang = { get state() { return S; }, get lesson() { return lesson; }, W: (id) => W(id) }; // для отладки из консоли
render();
