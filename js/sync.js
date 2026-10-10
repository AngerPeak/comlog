/* Синхронизация ПК ↔ iPhone через приватный GitHub Gist.
   Данные сжимаются и шифруются AES-256 ключом из «кода подключения»: GitHub видит только шифр.
   Слияние по записям: у каждого заказа/шаблона есть updatedAt, удаления хранятся «надгробиями». */
const SYNC_FILE = "comlog.sync.json";

const b64 = {
  enc(bytes) { let s = ""; const a = new Uint8Array(bytes); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); },
  dec(str) { const s = atob(str); const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; },
  url(str) { return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  unurl(str) { str = str.replace(/-/g, "+").replace(/_/g, "/"); return str + "===".slice((str.length + 3) % 4); },
};

async function streamBytes(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** Стабильная строка состояния: ключи и записи отсортированы, чтобы сравнение не зависело от порядка. */
function canon(state) {
  const s = { ...state, orders: [...state.orders].sort((x, y) => (x.id < y.id ? -1 : 1)), templates: [...state.templates].sort((x, y) => (x.id < y.id ? -1 : 1)) };
  return JSON.stringify(s, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v));
}

function mergeStates(a, b) {
  const pickNewer = (x, y) => (!x ? y : !y ? x : (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);
  const out = normalizeState({});
  out.createdAt = [a.createdAt, b.createdAt].sort()[0];
  for (const kind of ["orders", "templates"]) {
    const del = { ...a.deleted[kind] };
    for (const [id, ts] of Object.entries(b.deleted[kind])) del[id] = Math.max(del[id] || 0, ts);
    const m = new Map();
    for (const x of a[kind]) m.set(x.id, x);
    for (const y of b[kind]) m.set(y.id, pickNewer(m.get(y.id), y));
    out[kind] = Array.from(m.values()).filter(x => !(del[x.id] >= (x.updatedAt || 0)));
    for (const x of out[kind]) delete del[x.id];
    out.deleted[kind] = del;
  }
  out.services = { ...a.services };
  for (const [k, v] of Object.entries(b.services)) out.services[k] = pickNewer(out.services[k], v);
  const bSet = (b.settingsUpdatedAt || 0) > (a.settingsUpdatedAt || 0);
  out.settings = bSet ? b.settings : a.settings;
  out.settingsUpdatedAt = Math.max(a.settingsUpdatedAt || 0, b.settingsUpdatedAt || 0);
  const bGame = (b.gameUpdatedAt || 0) > (a.gameUpdatedAt || 0);
  const g = JSON.parse(JSON.stringify(bGame ? b.game : a.game)), other = bGame ? a.game : b.game;
  g.owned = Array.from(new Set([...g.owned, ...other.owned]));
  for (const [id, d] of Object.entries(other.achievements)) if (!g.achievements[id] || d < g.achievements[id]) g.achievements[id] = d;
  for (const [id, d] of Object.entries(other.notified)) if (!g.notified[id] || d > g.notified[id]) g.notified[id] = d;
  g.lastLevel = Math.max(a.game.lastLevel || 1, b.game.lastLevel || 1);
  out.game = g;
  out.gameUpdatedAt = Math.max(a.gameUpdatedAt || 0, b.gameUpdatedAt || 0);
  out.orders.sort((x, y) => x.createdAt - y.createdAt);
  return out;
}

const Sync = {
  busy: false,
  timer: null,
  status: "",

  get cfg() { return Store.local.sync; },
  parseCode(code) {
    const m = String(code).trim().match(/^COMLOG-([A-Za-z0-9_-]+)$/);
    if (!m) throw new Error("Код подключения должен начинаться с COMLOG-");
    const o = JSON.parse(new TextDecoder().decode(b64.dec(b64.unurl(m[1]))));
    if (!o.g || !o.t || !o.k) throw new Error("Код подключения повреждён");
    return o;
  },
  makeCode(o) { return "COMLOG-" + b64.url(b64.enc(new TextEncoder().encode(JSON.stringify(o)))); },

  async key(k) { return crypto.subtle.importKey("raw", b64.dec(k), "AES-GCM", false, ["encrypt", "decrypt"]); },
  async encrypt(state, k) {
    let bytes = new TextEncoder().encode(JSON.stringify(state));
    const z = typeof CompressionStream !== "undefined";
    if (z) bytes = await streamBytes(bytes, new CompressionStream("gzip"));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.key(k), bytes);
    return JSON.stringify({ app: "COMLOG", v: 1, z, iv: b64.enc(iv), data: b64.enc(data), at: new Date().toISOString() });
  },
  async decrypt(text, k) {
    const p = JSON.parse(text);
    let bytes;
    try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.dec(p.iv) }, await this.key(k), b64.dec(p.data))); }
    catch { throw new Error("Не удалось расшифровать — проверьте код подключения"); }
    if (p.z) bytes = await streamBytes(bytes, new DecompressionStream("gzip"));
    return JSON.parse(new TextDecoder().decode(bytes));
  },

  async gh(path, token, opts = {}) {
    let r;
    try {
      r = await fetch("https://api.github.com" + path, {
        ...opts, cache: "no-store",
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      });
    } catch { throw new Error("Нет связи с GitHub — проверьте интернет"); }
    if (r.status === 401) throw new Error("GitHub отклонил токен — проверьте его или создайте новый");
    if (r.status === 403) throw new Error("Токену не хватает прав: нужен доступ «gist»");
    if (r.status === 404) throw new Error("Хранилище не найдено — возможно, его удалили");
    if (!r.ok) throw new Error(`GitHub ответил ошибкой ${r.status}`);
    return r.json();
  },
  async pull(c) {
    const gist = await this.gh(`/gists/${c.g}`, c.t);
    const f = gist.files && gist.files[SYNC_FILE];
    if (!f) throw new Error("В хранилище нет данных COMLOG");
    const text = f.truncated ? await (await fetch(f.raw_url, { cache: "no-store" })).text() : f.content;
    return normalizeState(await this.decrypt(text, c.k));
  },
  async push(c, state) {
    await this.gh(`/gists/${c.g}`, c.t, { method: "PATCH", body: JSON.stringify({ files: { [SYNC_FILE]: { content: await this.encrypt(state, c.k) } } }) });
  },

  /** Первое устройство: создать хранилище. */
  async create(token) {
    token = token.trim();
    if (!token) throw new Error("Вставьте токен GitHub");
    const k = b64.enc(crypto.getRandomValues(new Uint8Array(32)));
    Store.stamp();
    const gist = await this.gh("/gists", token, {
      method: "POST",
      body: JSON.stringify({ description: "COMLOG sync (зашифровано)", public: false, files: { [SYNC_FILE]: { content: await this.encrypt(Store.state, k) } } }),
    });
    const code = this.makeCode({ g: gist.id, t: token, k });
    Store.local.sync = { code, auto: true, last: Date.now(), error: null };
    await Store.saveLocal();
    return code;
  },
  /** Второе устройство: подключиться по коду. */
  async connect(code) {
    const c = this.parseCode(code);
    await this.pull(c);   // проверка доступа и ключа
    Store.local.sync = { code: code.trim(), auto: true, last: 0, error: null };
    await Store.saveLocal();
    return this.run("connect");
  },
  async disconnect() { Store.local.sync = null; await Store.saveLocal(); this.render(); },

  async run(reason = "") {
    const cfg = this.cfg;
    if (!cfg || this.busy) return;
    if (!navigator.onLine) { this.status = "нет сети"; this.render(); return; }
    this.busy = true; this.status = "синхронизация…"; this.render();
    try {
      const c = this.parseCode(cfg.code);
      clearTimeout(Store.saveTimer);
      Store.stamp();
      const remote = await this.pull(c);
      const merged = mergeStates(Store.state, remote);
      const mj = canon(merged);
      if (mj !== canon(Store.state)) Store.applyMerged(merged);
      if (mj !== canon(remote)) await this.push(c, merged);
      cfg.last = Date.now(); cfg.error = null; this.status = "";
      if (reason === "manual") toast("Синхронизировано", new Date(cfg.last).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), "ok", "sync");
    } catch (e) {
      console.error(e);
      cfg.error = e.message || String(e); this.status = "";
      if (reason === "manual" || reason === "connect") toast("Синхронизация не удалась", cfg.error, "err", "x");
    } finally {
      this.busy = false;
      await Store.saveLocal();
      this.render();
    }
  },
  soon() {
    if (!this.cfg || !this.cfg.auto) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run("change"), 6000);
  },
  start() {
    if (this.cfg && this.cfg.auto) setTimeout(() => this.run("start"), 1500);
    setInterval(() => { if (this.cfg && this.cfg.auto && document.visibilityState === "visible") this.run("timer"); }, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && this.cfg && this.cfg.auto) this.run("focus"); });
    window.addEventListener("online", () => this.soon());
  },

  /** Значок состояния в шапке. */
  render() {
    const el = $("#syncBadge");
    if (!el) return;
    const c = this.cfg;
    el.hidden = !c;
    if (!c) return;
    el.className = "icon-btn sync-badge " + (this.busy ? "spin" : c.error ? "err" : "ok");
    el.title = this.busy ? "Синхронизация…" : c.error ? "Ошибка синхронизации: " + c.error : c.last ? "Синхронизировано " + new Date(c.last).toLocaleString("ru-RU") : "Синхронизация";
    if (currentTab === "settings" && $("#syncBox")) SettingsView.renderSync();
  },
};
