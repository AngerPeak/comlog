/* Хранилище: состояние, миграции, сохранение (Python на ПК, IndexedDB в браузере/на iPhone),
   учёт изменений для синхронизации. */
const DATA_VERSION = 2;

const DEFAULT_COLUMN_COLORS = {
  date: "#9aa0a6", client: "#6fb6ff", service: "#b48cff", price: "#ffb547",
  received: "#5ee0b5", done: "#8f9cff", paid: "#c2f02f", deadline: "#ff8fb1",
};

/* Отдельно включаемые функции — чтобы интерфейс не перегружался. */
const FEATURES = [
  ["hourly", "Почасовая оплата", "Кнопка «Начать» с таймером, прайс = часы × ставка"],
  ["track", "Учёт времени", "Секундомер ⏱ у обычных заказов: цена не меняется, но видна реальная ставка за час"],
  ["subtasks", "Подзадачи", "Список пунктов под заказом"],
  ["notes", "Заметки и ссылки", "Комментарий, ТЗ и ссылка на переписку или файлы у заказа"],
  ["contacts", "Контакты клиентов", "Кнопка «Написать» у заказа, если у клиента указан контакт"],
  ["estimates", "Сметы", "Вкладка со списком работ клиента за период — для отчёта и оплаты"],
  ["piggy", "Копилка", "Откладывать процент с каждой оплаты на свои цели"],
  ["calendar", "Вид «Календарь»", "Заказы и дедлайны по дням месяца"],
  ["debts", "Напоминания о долгах", "Если работа сдана, а оплаты долго нет"],
];
const DEFAULT_FEATURES = Object.fromEntries(FEATURES.map(([k]) => [k, true]));
const SIMPLE_FEATURES = { ...Object.fromEntries(FEATURES.map(([k]) => [k, false])), subtasks: true, debts: true };
function feat(name) { return Store.settings.features?.[name] !== false; }

function defaultSettings() {
  return {
    features: { ...DEFAULT_FEATURES },
    onboarded: false,
    debtDays: 14,               // через сколько дней без оплаты напоминать о долге
    density: "normal",          // normal | compact
    siteUrl: "",                // адрес веб-версии на GitHub Pages (для автообновления ПК)
    heroName: "Герой",
    monthlyGoal: 70000,
    remindDays: 2,
    winReminders: true,
    reminderCount: 3,
    reminderTimes: ["10:00", "15:00", "20:00"],
    incomeBy: "order",          // order — доход в месяц заказа; payment — в месяц оплаты
    taxEnabled: false,
    taxRate: 6,
    undoDelete: true,
    hourlyRate: 1000,
    hourlyAll: false,           // почасовая оплата для всех новых и невыполненных заказов
    timeRound: 1,               // округление времени вверх, минут

    showGame: true,
    gameNotify: true,
    theme: "dark",
    accent: "#c2f02f",
    colorColumns: false,
    columnColors: { ...DEFAULT_COLUMN_COLORS },
    serviceColors: true,
    ordersView: "table",
    dismissedDupes: [],
  };
}

function defaultState() {
  return {
    version: DATA_VERSION,
    createdAt: todayISO(),
    orders: [],
    templates: [],
    services: {},               // ключ услуги → { color, hidden, updatedAt }
    clients: {},                // имя клиента → { contact, updatedAt }
    goals: [],                  // копилка: [{ id, name, target, percent, since, manual, updatedAt }]
    settings: defaultSettings(),
    settingsUpdatedAt: 0,
    game: {
      owned: ["skin_graphite"],
      equipped: { skin: "skin_graphite", head: null, eyes: null, neck: null, aura: null, pet: null },
      achievements: {},
      notified: {},
      lastLevel: 1,
    },
    gameUpdatedAt: 0,
    deleted: { orders: {}, templates: {}, goals: {} },
  };
}

function normalizePayments(o) {
  if (Array.isArray(o.payments)) {
    return o.payments.map(p => ({
      id: p.id || uid(), date: p.date || null, amount: Math.max(0, Math.round(+p.amount || 0)),
      ...(p.auto ? { auto: true } : {}), ...(p.imported ? { imported: true } : {}),
    })).filter(p => p.amount > 0);
  }
  const r = +o.received || 0;   // данные версии 1: одна сумма без истории
  if (r <= 0) return [];
  if (o.imported && o.baseReceived !== undefined && r > +o.baseReceived) {   // архив, по которому уже доплатили в COMLOG
    const base = +o.baseReceived;
    return [
      ...(base > 0 ? [{ id: uid(), date: null, amount: base, imported: true }] : []),
      { id: uid(), date: o.paidDate || todayISO(), amount: r - base },
    ];
  }
  return [{ id: uid(), date: o.imported ? null : (o.paidDate || o.date || null), amount: r, ...(o.imported ? { imported: true } : {}) }];
}

function normalizeOrder(o) {
  const payments = normalizePayments(o);
  const o2 = {
    id: o.id || uid(),
    date: o.date || todayISO(),
    dateUnknown: !!o.dateUnknown,
    client: o.client || "",
    service: o.service || "",
    price: Math.max(0, Math.round(+o.price || 0)),
    received: 0,
    payments,
    done: !!o.done,
    doneDate: o.doneDate || null,
    paid: !!o.paid,
    paidDate: o.paidDate || null,
    deadline: o.deadline || null,
    remind: o.remind !== false,
    // почасовая оплата: прайс = оплачиваемые часы × ставка
    hourly: !!o.hourly,
    rate: Math.max(0, Math.round(+o.rate || 0)),
    timeMs: Math.max(0, Math.round(+o.timeMs || 0)),
    timerStart: o.timerStart || null,
    subtasks: Array.isArray(o.subtasks) ? o.subtasks.filter(s => s && s.text).map(s => ({ id: s.id || uid(), text: String(s.text), done: !!s.done })) : [],
    // учёт времени отдельно от почасовой оплаты: цену не меняет
    trackMs: Math.max(0, Math.round(+o.trackMs || 0)),
    trackStart: o.trackStart || null,
    deadlineTime: /^\d\d:\d\d$/.test(o.deadlineTime || "") ? o.deadlineTime : "",
    note: o.note || "",
    link: o.link || "",
    createdAt: o.createdAt || Date.now(),
    updatedAt: o.updatedAt || o.createdAt || 0,
    ...(o.imported ? { imported: true } : {}),
  };
  recalcOrder(o2);
  return o2;
}

function normalizeTemplate(t) {
  return {
    id: t.id || uid(), service: (t.service || "").trim(), price: Math.max(0, Math.round(+t.price || 0)),
    qty: Math.max(1, Math.min(99, Math.round(+t.qty || 1))),   // пакет: price — цена за весь пакет
    client: (t.client || "").trim(), createdAt: t.createdAt || Date.now(), updatedAt: t.updatedAt || t.createdAt || 0,
  };
}
function normalizeGoal(g) {
  return {
    id: g.id || uid(), name: (g.name || "Цель").trim(), target: Math.max(0, Math.round(+g.target || 0)),
    percent: Math.max(0, Math.min(100, +g.percent || 0)), since: g.since || todayISO(),
    manual: Math.round(+g.manual || 0), createdAt: g.createdAt || Date.now(), updatedAt: g.updatedAt || g.createdAt || 0,
  };
}
/** Цены заказов пакета: делим поровну, остаток — в последний. */
function packagePrices(total, qty) {
  const each = Math.floor(total / qty);
  return Array.from({ length: qty }, (_, i) => i === qty - 1 ? total - each * (qty - 1) : each);
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const v1 = !raw.version || raw.version < 2;
  const s = {
    ...base, ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    game: { ...base.game, ...(raw.game || {}) },
    deleted: { orders: { ...(raw.deleted?.orders || {}) }, templates: { ...(raw.deleted?.templates || {}) }, goals: { ...(raw.deleted?.goals || {}) } },
    services: { ...(raw.services || {}) },
    clients: { ...(raw.clients || {}) },
  };
  s.settings.features = { ...DEFAULT_FEATURES, ...(raw.settings?.features || {}) };
  if (raw.settings && raw.settings.onboarded === undefined && (raw.orders || []).length) s.settings.onboarded = true;
  s.goals = (raw.goals || []).map(normalizeGoal);
  if (v1 && raw.settings && raw.settings.nativeNotify === false) s.settings.winReminders = false;
  delete s.settings.nativeNotify;
  s.settings.columnColors = { ...DEFAULT_COLUMN_COLORS, ...(s.settings.columnColors || {}) };
  s.game.equipped = { ...base.game.equipped, ...(s.game.equipped || {}) };
  s.game.owned = Array.from(new Set(["skin_graphite", ...(s.game.owned || [])]));
  delete s.game.spent;   // теперь считается из купленного
  s.orders = (raw.orders || []).map(o => normalizeOrder(v1 && o.imported ? { ...o, dateUnknown: true } : o));
  s.templates = (raw.templates || []).map(normalizeTemplate);
  s.version = DATA_VERSION;
  return s;
}

/* ----- платежи ----- */
function recalcOrder(o) {
  o.received = o.payments.reduce((s, p) => s + p.amount, 0);
  if (o.price > 0) o.paid = o.received >= o.price;
  o.paidDate = o.paid ? (o.payments.map(p => p.date).filter(Boolean).sort().pop() || o.paidDate || null) : null;
}
/** Изменить общую сумму «Получено»: прибавка — новый платёж сегодня, уменьшение — срезаем последние платежи. */
function setReceived(o, total) {
  total = Math.max(0, Math.round(total));
  let diff = total - o.received;
  if (diff > 0) o.payments.push({ id: uid(), date: todayISO(), amount: diff });
  while (diff < 0 && o.payments.length) {
    const p = o.payments[o.payments.length - 1];
    if (p.amount <= -diff) { diff += p.amount; o.payments.pop(); }
    else { p.amount += diff; diff = 0; }
  }
  recalcOrder(o);
}
function setPaid(o, v) {
  if (v) {
    const rest = o.price - o.received;
    if (rest > 0) o.payments.push({ id: uid(), date: todayISO(), amount: rest, auto: true });
    o.paid = true;
  } else {
    if (o.price > 0) while (o.payments.length && o.payments.reduce((s, p) => s + p.amount, 0) >= o.price) o.payments.pop();
    else o.payments = [];
    o.paid = false;
  }
  recalcOrder(o);
}
function setPrice(o, price) {
  const wasPaid = o.paid && o.price > 0;
  o.price = Math.max(0, Math.round(price));
  if (wasPaid) setReceived(o, o.price); else recalcOrder(o);
}
function debtOf(o) { return Math.max(0, o.price - o.received); }

/* ----- почасовая оплата и таймер ----- */
function timerElapsed(o) { return o.timeMs + (o.timerStart ? Math.max(0, Date.now() - o.timerStart) : 0); }
function billedMinutes(ms) { const r = Math.max(1, Store.settings.timeRound || 1); return Math.ceil(ms / 60000 / r - 1e-9) * r; }
function hourlyPrice(o, ms = timerElapsed(o)) { return Math.round(billedMinutes(ms) / 60 * o.rate); }
function startTimer(o) {
  if (!o.hourly) { o.hourly = true; o.rate = o.rate || Store.settings.hourlyRate; }
  if (!o.timerStart) o.timerStart = Date.now();
}
function stopTimer(o) {
  if (o.timerStart) { o.timeMs += Math.max(0, Date.now() - o.timerStart); o.timerStart = null; }
  setPrice(o, hourlyPrice(o));
}
function setWorkTime(o, ms) {
  o.timeMs = Math.max(0, Math.round(ms));
  if (o.timerStart) o.timerStart = Date.now();
  setPrice(o, hourlyPrice(o));
}
/* ----- учёт времени (не влияет на цену) ----- */
function trackElapsed(o) { return o.trackMs + (o.trackStart ? Math.max(0, Date.now() - o.trackStart) : 0); }
function toggleTrack(o) {
  if (o.trackStart) { o.trackMs += Math.max(0, Date.now() - o.trackStart); o.trackStart = null; }
  else o.trackStart = Date.now();
}
/** Отработанное время заказа: таймер почасовой оплаты или секундомер учёта. */
function workMs(o) { return o.hourly ? timerElapsed(o) : trackElapsed(o); }

/* ----- клиенты: контакт для кнопки «Написать» ----- */
function clientMeta(name) { return Store.state.clients[name.trim()] ||= { contact: "", updatedAt: 0 }; }
/** «@nick», «t.me/nick», телефон или любая ссылка → адрес, который можно открыть. */
function contactUrl(contact) {
  const c = String(contact || "").trim();
  if (!c) return "";
  if (/^@[\w.]{3,}$/.test(c)) return "https://t.me/" + c.slice(1);
  if (/^\+?[\d\s()-]{7,}$/.test(c)) return "tel:" + c.replace(/[^\d+]/g, "");
  if (/^[\w.-]+@[\w-]+\.[\w.]+$/.test(c)) return "mailto:" + c;
  if (/^(https?:|tg:|mailto:|tel:)/i.test(c)) return c;
  if (/^[\w-]+\.[\w.-]+\//.test(c) || /^(t\.me|vk\.com|wa\.me|instagram\.com)/i.test(c)) return "https://" + c;
  return "";
}
function clientContact(name) { return feat("contacts") ? contactUrl(Store.state.clients[(name || "").trim()]?.contact) : ""; }

/* ----- копилка: процент с каждой оплаты после старта цели + ручные взносы ----- */
function goalSaved(g) {
  let auto = 0;
  for (const o of Store.orders) for (const p of o.payments) if (!p.imported && p.date && p.date >= g.since) auto += p.amount;
  return Math.max(0, Math.round(auto * g.percent / 100) + g.manual);
}

/** Через сколько дней после сдачи клиент платит (только заказы с датами сдачи и оплаты). */
function paymentDelays(client = null) {
  const out = [];
  for (const o of Store.orders) {
    if (o.imported || !o.doneDate || (client && o.client.trim() !== client)) continue;
    const last = o.payments.map(p => p.date).filter(Boolean).sort().pop();
    if (!last || !o.paid) continue;
    out.push({ o, days: Math.max(0, daysBetween(o.doneDate, last)) });
  }
  return out;
}

function fmtDur(ms, clock = false) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (clock) return `${h}:${pad(m)}:${pad(s % 60)}`;
  return h ? `${h} ч${m ? ` ${m} мин` : ""}` : `${m} мин`;
}

/* ----- IndexedDB для веб-версии ----- */
const IDB = {
  db: null,
  open() {
    return this.db ||= new Promise((res, rej) => {
      const r = indexedDB.open("comlog", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    try {
      const db = await this.open();
      return await new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => rej(q.error); });
    } catch { return localStorage.getItem("comlog-" + k); }
  },
  async set(k, v) {
    try {
      const db = await this.open();
      await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch { localStorage.setItem("comlog-" + k, v); }
  },
};

const Store = {
  state: defaultState(),
  local: { sync: null },        // настройки только этого устройства (не синхронизируются и не попадают в бэкап)
  listeners: [],
  saveTimer: null,
  native: false,
  snap: null,

  api() { return window.pywebview && window.pywebview.api; },

  async load() {
    let text = null, localText = null;
    try {
      if (this.api()) { this.native = true; text = await this.api().load(); localText = await this.api().load_local(); }
      else {
        text = await IDB.get("data");
        if (!text && localStorage.getItem("comlog-data")) text = localStorage.getItem("comlog-data");
        localText = await IDB.get("local");
      }
    } catch (e) { console.error(e); }
    try { this.state = normalizeState(text ? JSON.parse(text) : null); }
    catch (e) { console.error(e); this.state = defaultState(); toast("База повреждена", "Восстановите её из бэкапа в настройках", "err", "x"); }
    try { this.local = { sync: null, ...(localText ? JSON.parse(localText) : {}) }; } catch { this.local = { sync: null }; }
    this.resetSnap();
    this.resetUndo();
    if (!this.native) this.webSnapshot(text);
  },

  /** Веб-версия: автокопия раз в 12 часов, хранится 10 штук. */
  async webSnapshot(text) {
    if (!text) return;
    try {
      const list = JSON.parse((await IDB.get("snapshots")) || "[]");
      if (list.length && Date.now() - list[0].ts < 12 * 3600e3) return;
      list.unshift({ ts: Date.now(), text });
      await IDB.set("snapshots", JSON.stringify(list.slice(0, 10)));
    } catch (e) { console.error(e); }
  },
  async webSnapshots() { try { return JSON.parse((await IDB.get("snapshots")) || "[]"); } catch { return []; } },

  serialize() { return JSON.stringify(this.state, null, 1); },

  /* ----- учёт изменений: сравниваем с прошлым снимком, ставим updatedAt и «надгробия» удалённым ----- */
  sig(x) { return JSON.stringify({ ...x, updatedAt: 0 }); },
  resetSnap() {
    const s = this.state;
    this.snap = {
      orders: new Map(s.orders.map(o => [o.id, this.sig(o)])),
      templates: new Map(s.templates.map(t => [t.id, this.sig(t)])),
      goals: new Map(s.goals.map(g => [g.id, this.sig(g)])),
      services: new Map(Object.entries(s.services).map(([k, v]) => [k, this.sig(v)])),
      clients: new Map(Object.entries(s.clients).map(([k, v]) => [k, this.sig(v)])),
      settings: JSON.stringify(s.settings),
      game: JSON.stringify(s.game),
    };
  },
  stamp() {
    const s = this.state, now = Date.now();
    for (const kind of ["orders", "templates", "goals"]) {
      const snap = this.snap[kind], seen = new Set();
      for (const x of s[kind]) {
        seen.add(x.id);
        const j = this.sig(x);
        if (snap.get(x.id) !== j) { x.updatedAt = now; snap.set(x.id, j); delete s.deleted[kind][x.id]; }
      }
      for (const id of Array.from(snap.keys())) if (!seen.has(id)) { s.deleted[kind][id] = now; snap.delete(id); }
    }
    for (const map of ["services", "clients"]) {
      for (const [k, v] of Object.entries(s[map])) {
        const j = this.sig(v);
        if (this.snap[map].get(k) !== j) { v.updatedAt = now; this.snap[map].set(k, j); }
      }
    }
    const st = JSON.stringify(s.settings);
    if (st !== this.snap.settings) { s.settingsUpdatedAt = now; this.snap.settings = st; }
    const gm = JSON.stringify(s.game);
    if (gm !== this.snap.game) { s.gameUpdatedAt = now; this.snap.game = gm; }
  },

  save(immediate = false) {
    clearTimeout(this.saveTimer);
    const run = async () => {
      try {
        this.stamp();
        const text = this.serialize();
        if (this.api()) await this.api().save(text);
        else await IDB.set("data", text);
        if (typeof Sync !== "undefined") Sync.soon();
      } catch (e) { console.error(e); toast("Не удалось сохранить", String(e), "err", "x"); }
    };
    if (immediate) return run();
    this.saveTimer = setTimeout(run, 350);
  },
  async saveLocal() {
    const text = JSON.stringify(this.local);
    try { if (this.api()) await this.api().save_local(text); else await IDB.set("local", text); } catch (e) { console.error(e); }
  },

  /** Изменили данные → запомнить для отмены, сохранить и сообщить вкладкам. */
  commit(reason = "data") {
    this.rememberUndo();
    this.save();
    this.listeners.forEach(fn => fn(reason));
  },

  /* ----- Ctrl+Z: снимки состояния до каждого изменения (последние 40) ----- */
  undoStack: [], redoStack: [], lastSnapText: null, lastUndoAt: 0,
  /** Снимок для отмены — без служебных полей синхронизации и игры. */
  undoText() {
    return JSON.stringify(this.state, (k, v) => (k === "updatedAt" || k === "settingsUpdatedAt" || k === "gameUpdatedAt" || k === "deleted" || k === "game") ? undefined : v);
  },
  resetUndo() { this.undoStack = []; this.redoStack = []; this.lastSnapText = this.undoText(); },
  rememberUndo() {
    const cur = this.undoText();
    if (this.lastSnapText !== null && cur !== this.lastSnapText) {
      if (Date.now() - this.lastUndoAt > 700 || !this.undoStack.length) this.undoStack.push(this.lastSnapText);
      if (this.undoStack.length > 40) this.undoStack.shift();
      this.redoStack = [];
      this.lastUndoAt = Date.now();
    }
    this.lastSnapText = cur;
  },
  /** Шаг назад (или вперёд при redo = true). */
  undo(redo = false) {
    this.rememberUndo();
    const from = redo ? this.redoStack : this.undoStack, to = redo ? this.undoStack : this.redoStack;
    if (!from.length) return false;
    to.push(this.lastSnapText);
    const text = from.pop(), snap = JSON.parse(text), cur = this.state;
    // метки времени и «надгробия» берём текущие: изменённое отменой получит новую метку при сохранении и уйдёт в синхронизацию
    const upd = new Map([...cur.orders, ...cur.templates, ...cur.goals].map(x => [x.id, x.updatedAt]));
    for (const kind of ["orders", "templates", "goals"]) (snap[kind] || []).forEach(x => { if (upd.has(x.id)) x.updatedAt = upd.get(x.id); });
    for (const map of ["services", "clients"]) for (const [k, v] of Object.entries(snap[map] || {})) if (cur[map][k]) v.updatedAt = cur[map][k].updatedAt;
    this.state = normalizeState({ ...snap, game: cur.game, deleted: cur.deleted, settingsUpdatedAt: cur.settingsUpdatedAt, gameUpdatedAt: cur.gameUpdatedAt });
    this.lastSnapText = text;
    this.save();
    this.listeners.forEach(fn => fn("undo"));
    return true;
  },
  on(fn) { this.listeners.push(fn); },

  /** Полная замена (восстановление бэкапа). Снимок не сбрасываем: отличия разойдутся по синхронизации. */
  replaceAll(raw) {
    this.state = normalizeState(raw);
    this.resetUndo();
    this.save(true);
    this.listeners.forEach(fn => fn("restore"));
  },
  /** Применить результат синхронизации (уже со всеми метками времени). */
  applyMerged(merged) {
    this.state = merged;
    this.resetSnap();
    this.resetUndo();
    const text = this.serialize();
    (this.api() ? this.api().save(text) : IDB.set("data", text)).catch?.(console.error);
    this.listeners.forEach(fn => fn("sync"));
  },

  order(id) { return this.state.orders.find(o => o.id === id); },
  get orders() { return this.state.orders; },
  get settings() { return this.state.settings; },
  get game() { return this.state.game; },
};

/* ----- доход: по дате заказа или по дате оплаты (настройка) ----- */
function incomeEntries(from = "0000", to = "9999", client = null) {
  const byPay = Store.settings.incomeBy === "payment", out = [];
  for (const o of Store.orders) {
    if (client && o.client.trim() !== client) continue;
    if (!byPay) {
      if (o.received > 0 && o.date >= from && o.date <= to) out.push({ date: o.date, amount: o.received, o, undated: o.dateUnknown });
      continue;
    }
    for (const p of o.payments) {
      const d = p.date || o.date;
      if (d >= from && d <= to) out.push({ date: d, amount: p.amount, o, undated: !p.date && o.dateUnknown });
    }
  }
  return out;
}

function ordersInRange(from, to, client = null) {
  return Store.orders.filter(o => o.date >= from && o.date <= to && (!client || o.client.trim() === client));
}
function ordersInMonth(key) { return ordersInRange(monthStart(key), monthEnd(key)); }

/** Сводка за период: деньги по выбранному способу учёта, долги и счётчики — по дате заказа. */
function rangeStats(from, to, client = null) {
  const list = ordersInRange(from, to, client);
  const entries = incomeEntries(from, to, client);
  const received = entries.reduce((s, e) => s + e.amount, 0);
  let price = 0, debt = 0, done = 0, paid = 0;
  for (const o of list) { price += o.price; debt += debtOf(o); if (o.done) done++; if (o.paid) paid++; }
  const payers = new Set(entries.map(e => e.o.id)).size;
  const tax = Store.settings.taxEnabled ? Math.round(received * Store.settings.taxRate / 100) : 0;
  return { list, entries, received, price, debt, done, paid, count: list.length, avg: payers ? received / payers : 0, tax };
}

function clientNames() {
  const set = new Set();
  Store.orders.forEach(o => o.client.trim() && set.add(o.client.trim()));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
}

/** Все услуги: из заказов и прайс-листа, сгруппированные без учёта регистра. */
function serviceCatalog() {
  const m = new Map();
  const touch = (name, key = serviceKey(name)) => {
    if (!key) return null;
    if (!m.has(key)) m.set(key, { key, names: new Map(), count: 0, total: 0, lastPrice: 0, lastDate: "", template: null });
    const s = m.get(key);
    s.names.set(name.trim(), (s.names.get(name.trim()) || 0) + 1);
    return s;
  };
  for (const o of Store.orders) {
    const s = touch(o.service);
    if (!s) continue;
    s.count++; s.total += o.received;
    if (o.price > 0 && o.date >= s.lastDate) { s.lastDate = o.date; s.lastPrice = o.price; }
  }
  for (const t of Store.state.templates) { const s = touch(t.service); if (s) s.template = t; }
  for (const s of m.values()) {
    s.name = s.template ? s.template.service : [...s.names].sort((a, b) => b[1] - a[1])[0][0];
    const meta = Store.state.services[s.key] || {};
    s.color = meta.color || ""; s.hidden = !!meta.hidden;
  }
  return Array.from(m.values());
}
function serviceMeta(key) { return Store.state.services[key] ||= { color: "", hidden: false, updatedAt: 0 }; }
function serviceColor(name) {
  if (!Store.settings.serviceColors) return "";
  return Store.state.services[serviceKey(name)]?.color || "";
}

/** Цена по умолчанию: шаблон прайс-листа → прошлый заказ этого клиента → прошлый заказ этой услуги. */
function suggestPrice(client, service) {
  const key = serviceKey(service);
  if (!key) return 0;
  const tpl = Store.state.templates.find(t => serviceKey(t.service) === key && (!t.client || t.client === client.trim()));
  if (tpl && tpl.price) return Math.round(tpl.price / (tpl.qty || 1));
  let best = null, bestAny = null;
  for (const o of Store.orders) {
    if (serviceKey(o.service) !== key || !o.price) continue;
    if (!bestAny || o.date > bestAny.date || (o.date === bestAny.date && o.createdAt > bestAny.createdAt)) bestAny = o;
    if (o.client.trim() === client.trim() && (!best || o.date > best.date || (o.date === best.date && o.createdAt > best.createdAt))) best = o;
  }
  return (best || bestAny)?.price || 0;
}
