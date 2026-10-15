/* Точка входа: вкладки, тема, общие элементы, запуск на ПК и в браузере/iPhone. */
const TABS = {
  orders: { title: "Заказы", icon: "list", view: OrdersView },
  analytics: { title: "Аналитика", icon: "chart", view: AnalyticsView },
  clients: { title: "Клиенты", icon: "users", view: ClientsView },
  pricelist: { title: "Прайс-лист", icon: "tag", view: PriceListView },
  estimates: { title: "Сметы", icon: "receipt", view: EstimatesView, feat: "estimates" },
  hero: { title: "Герой", icon: "user", view: HeroView, game: true },
  shop: { title: "Магазин", icon: "shop", view: ShopView, game: true },
  achievements: { title: "Достижения", icon: "trophy", view: AchievementsView },
  settings: { title: "Настройки", icon: "gear", view: SettingsView },
};
let currentTab = "orders";

function tabTitle(name) { return name === "achievements" && !Store.settings.showGame ? "Летопись" : TABS[name].title; }

function showTab(name) {
  if (!TABS[name] || (TABS[name].game && !Store.settings.showGame) || (TABS[name].feat && !feat(TABS[name].feat))) name = "orders";
  currentTab = name;
  $$("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  $("#pageTitle").textContent = tabTitle(name);
  $("#bellPop").hidden = true;
  $("#moreSheet").hidden = true;
  AC.close(); DeadlinePop.close(); MonthPicker.close();
  TABS[name].view.render();
  $("#page-" + name).scrollTop = 0;
}

function logoSVG(cls = "") {
  return `<svg class="wordmark ${cls}" viewBox="0 ${LOGO.y0} ${LOGO.w} ${LOGO.h}" aria-label="COMLOG"><path class="wm-com" d="${LOGO.com}"/><path class="wm-log" d="${LOGO.log}"/></svg>`;
}
function markSVG() { return `<svg viewBox="${LOGO.markBox.join(" ")}"><path d="${LOGO.mark}" fill-rule="evenodd"/></svg>`; }

/** Тема и акцент: акцент задаётся одной переменной, оттенки считаются в CSS. */
function applyTheme() {
  const s = Store.settings, root = document.documentElement;
  root.dataset.theme = s.theme;
  root.style.setProperty("--accent", s.accent);
  root.style.setProperty("--accent-ink", inkFor(s.accent));
  for (const [k, c] of Object.entries(s.columnColors)) root.style.setProperty(`--c-${k}`, c);
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  $('meta[name="theme-color"]')?.setAttribute("content", bg || "#0b0b0b");
}

function renderNav() {
  const game = Store.settings.showGame;
  const btn = (k, cls = "") => `<button data-tab="${k}" class="${cls} ${k === currentTab ? "active" : ""}">${icon(TABS[k].icon)}<span>${tabTitle(k)}</span>${k === "achievements" ? `<em class="nav-badge" id="achBadge" hidden></em>` : ""}</button>`;
  const on = k => !TABS[k].feat || feat(TABS[k].feat);
  $("#nav").innerHTML = ["orders", "analytics", "clients", "pricelist", "estimates"].filter(on).map(k => btn(k)).join("") + `<div class="nav-sep"></div>`
    + (game ? btn("hero") + btn("shop") : "") + btn("achievements") + `<div class="nav-sep"></div>` + btn("settings");
  // мобильная панель: 4 главные вкладки + «Ещё»
  const main = ["orders", "analytics", "clients", game ? "hero" : "pricelist"];
  $("#mnav").innerHTML = main.map(k => btn(k)).join("") + `<button id="moreBtn">${icon("dots")}<span>Ещё</span></button>`;
  $("#moreSheet").innerHTML = `<div class="more-list">${Object.keys(TABS).filter(k => !main.includes(k) && (!TABS[k].game || game) && on(k)).map(k => btn(k)).join("")}
    <button id="moreUndo">${icon("undo")}<span>Отменить действие</span></button></div>`;
  $$("[data-tab]").forEach(b => b.onclick = () => showTab(b.dataset.tab));
  $("#moreUndo").onclick = () => { $("#moreSheet").hidden = true; doUndo(); };
  $("#moreBtn").onclick = e => { e.stopPropagation(); $("#moreSheet").hidden = !$("#moreSheet").hidden; };
}

function renderChrome() {
  const g = Store.game, game = Store.settings.showGame;
  renderNav();
  $("#matterPill").hidden = !game;
  $("#sideHero").hidden = !game;
  if (game) {
    $("#matterTop").textContent = fmt(G.matter);
    $("#sideHero").innerHTML = `
      <div class="sh-top"><div class="sh-ava">${renderAvatarMini(g.equipped, G.stage)}</div>
        <div style="min-width:0"><div class="sh-name">${esc(Store.settings.heroName)}</div><div class="sh-lvl"><b>Ур. ${G.level}</b> · ${esc(G.title)}</div></div></div>
      <div class="xpbar"><i style="width:${(G.into / G.need) * 100}%"></i></div>
      <div class="sh-xp"><span>${fmt(G.into)} / ${fmt(G.need)} XP</span><span>${Math.round((G.into / G.need) * 100)}%</span></div>`;
    const opened = Object.keys(g.achievements).length;
    $("#achBadge").hidden = !opened;
    $("#achBadge").textContent = `${opened}/${ACHIEVEMENTS.length}`;
  }
  renderBell();
  renderTimerPill();
  Sync.render();
}

/* ---------- запуск ---------- */
function waitForBridge() {
  const inWebView = !!(window.chrome && window.chrome.webview);
  return new Promise(resolve => {
    if (window.pywebview && window.pywebview.api && window.pywebview.api.load) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    window.addEventListener("pywebviewready", finish);
    if (!inWebView) setTimeout(finish, 300);   // обычный браузер / iPhone
  });
}

async function boot() {
  $("#brand").innerHTML = `<div class="brand-mark">${markSVG()}</div>${logoSVG()}`;
  $("#mBrand").innerHTML = `<div class="brand-mark sm">${markSVG()}</div>${logoSVG("sm")}`;
  await waitForBridge();
  await Store.load();
  document.documentElement.classList.toggle("is-web", !Store.native);
  applyTheme();
  AC.init();

  OrdersView.mount();
  AnalyticsView.mount();
  ClientsView.mount();

  evaluateGame(true);
  gameReady = true;
  renderChrome();
  showTab("orders");

  Store.on(reason => {
    evaluateGame();
    renderChrome();
    scheduleWindowsReminders();
    if (reason === "restore" || reason === "sync" || reason === "undo") {
      // не перерисовываем поле, в котором человек сейчас печатает
      const a = document.activeElement, typing = a && a.matches("input, textarea") && a.closest(".page");
      if (reason === "restore") OrdersView.month = monthKey(todayISO());
      applyTheme();
      if (OrderSheet.id && !$("#modal").hidden) OrderSheet.render();
      if (!typing) showTab(currentTab); else if (currentTab === "orders") OrdersView.renderSummary();
      return;
    }
    if (currentTab === "orders") OrdersView.renderSummary();
    else if (!(currentTab === "settings" && reason === "settings")) TABS[currentTab].view.render();
  });

  document.addEventListener("click", e => {
    const go = e.target.closest("[data-goto]");
    if (go) showTab(go.dataset.goto);
    if (!e.target.closest(".bell-wrap")) $("#bellPop").hidden = true;
    if (!e.target.closest("#moreSheet, #moreBtn")) $("#moreSheet").hidden = true;
  });
  $("#bellBtn").onclick = () => { renderBell(); $("#bellPop").hidden = !$("#bellPop").hidden; };
  $("#syncBadge").onclick = () => Sync.run("manual");
  $("#modal").addEventListener("mousedown", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => {
    const typing = e.target.matches?.("input, textarea, select");
    if (e.key === "Escape" && !AC.isOpen()) { if (!$("#modal").hidden) closeModal(); $("#bellPop").hidden = true; DeadlinePop.close(); MonthPicker.close(); }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyN") { e.preventDefault(); if (currentTab !== "orders") showTab("orders"); OrdersView.add(); }
    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y — отмена и повтор (в полях ввода работает обычная отмена текста)
    if ((e.ctrlKey || e.metaKey) && !typing && (e.code === "KeyZ" || e.code === "KeyY")) { e.preventDefault(); doUndo(e.code === "KeyY" || e.shiftKey); }
    // Ctrl+D — повторить заказ, на котором стоит курсор
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyD" && currentTab === "orders") {
      e.preventDefault();
      const o = Store.order(OrdersView.lastRow);
      if (o) OrdersView.repeat(o); else toast("Выберите заказ", "Нажмите на строку, затем Ctrl+D", "warn", "copy");
    }
    if (e.key === "?" && !typing && $("#modal").hidden) showHotkeys();
  });

  setTimeout(() => { checkReminders(); checkDebtReminders(); }, 1200);
  setInterval(() => { checkReminders(); checkDebtReminders(); }, 10 * 60 * 1000);
  setTimeout(offerWrapped, 4000);
  // веб-версия запоминает свой адрес — по синхронизации он попадёт на ПК для автообновления
  if (!Store.native && location.protocol === "https:" && !Store.settings.siteUrl) { Store.settings.siteUrl = location.origin + location.pathname.replace(/[^/]*$/, ""); Store.save(); }
  if (!Store.settings.onboarded && !Store.orders.length) setTimeout(() => Onboarding.open(), 600);
  scheduleWindowsReminders();
  let day = todayISO();
  setInterval(() => {
    if (todayISO() !== day) { day = todayISO(); evaluateGame(); renderChrome(); if (currentTab === "orders") OrdersView.render(); checkReminders(); scheduleWindowsReminders(); }
  }, 60 * 1000);
  window.addEventListener("beforeunload", () => Store.save(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Store.save(true); });
  Sync.start();

  // офлайн-режим и установка на экран «Домой» — только для веб-версии
  Updater.init();
}

function doUndo(redo = false) {
  if (!Store.undo(redo)) return toast(redo ? "Нечего повторять" : "Нечего отменять", "", "warn", "undo");
  toast(redo ? "Действие повторено" : "Действие отменено", redo ? "" : "Ещё раз — Ctrl+Z, вернуть — Ctrl+Shift+Z", "ok", "undo");
}

function showHotkeys() {
  const k = (keys, what) => `<div class="hk-row"><span>${keys.map(x => `<kbd>${x}</kbd>`).join(" + ")}</span><span>${what}</span></div>`;
  const m = openModal(`<div class="sheet-head"><h3>${icon("keyboard")} Горячие клавиши</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
    <div class="hk">
      ${k(["Ctrl", "N"], "Новый заказ")}
      ${k(["Ctrl", "D"], "Повторить заказ, на котором стоит курсор")}
      ${k(["↑", "↓"], "То же поле в соседней строке")}
      ${k(["Enter"], "Следующее поле в строке")}
      ${k(["Ctrl", "Z"], "Отменить последнее действие")}
      ${k(["Ctrl", "Shift", "Z"], "Вернуть отменённое")}
      ${k(["Esc"], "Закрыть окно или подсказки")}
      ${k(["?"], "Эта шпаргалка")}
    </div>`);
  m.querySelector("[data-x]").onclick = closeModal;
}

/* ---------- первый запуск ---------- */
const Onboarding = {
  step: 0, data: null,
  open() {
    const s = Store.settings;
    this.data = this.data || { name: s.heroName === "Герой" ? "" : s.heroName, goal: s.monthlyGoal, rate: s.hourlyRate, theme: s.theme, accent: s.accent, mode: "simple", game: true };
    const d = this.data, steps = 3;
    const dots = `<div class="ob-dots">${Array.from({ length: steps }, (_, i) => `<i class="${i === this.step ? "on" : ""}"></i>`).join("")}</div>`;
    let body = "";
    if (this.step === 0) body = `<div class="ob-hello"><div class="brand-mark">${markSVG()}</div>${logoSVG()}</div>
      <h3>Добро пожаловать!</h3><p>COMLOG ведёт учёт заказов и доходов. Пара вопросов — и можно начинать.</p>
      <div class="form-grid">
        <label class="span2">Как к вам обращаться<input class="field" data-k="name" value="${esc(d.name)}" placeholder="Имя" maxlength="24"></label>
        <label>Цель на месяц, ₽<input class="field" data-k="goal" inputmode="numeric" value="${fmt(d.goal)}"></label>
        <label>Ставка за час, ₽<input class="field" data-k="rate" inputmode="numeric" value="${fmt(d.rate)}"></label>
      </div>`;
    if (this.step === 1) body = `<h3>Как будет выглядеть</h3><p>Это можно поменять в любой момент в настройках.</p>
      <div class="ob-label">Тема</div><div class="seg full" id="obTheme">${THEMES.map(([k, l]) => `<button data-v="${k}" class="${d.theme === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="ob-label">Акцентный цвет</div><div class="swatches">${ACCENTS.map(([c, n]) => `<button class="sw ${d.accent === c ? "on" : ""}" data-c="${c}" title="${n}" style="background:${c}"></button>`).join("")}</div>`;
    if (this.step === 2) body = `<h3>Сколько функций нужно?</h3><p>Отдельные функции можно включать и выключать в Настройках → «Функции».</p>
      <div class="ob-modes">
        <button class="ob-mode ${d.mode === "simple" ? "on" : ""}" data-m="simple"><b>Простой</b><span>Заказы, оплаты, сроки, аналитика, подзадачи</span></button>
        <button class="ob-mode ${d.mode === "full" ? "on" : ""}" data-m="full"><b>Полный</b><span>+ почасовая оплата, учёт времени, сметы, копилка, календарь, заметки, контакты</span></button>
      </div>
      <div class="set-row"><div class="sr-l"><div>Персонаж и прокачка</div><div>Опыт за заработанные деньги, магазин, достижения</div></div><button class="toggle ${d.game ? "on" : ""}" id="obGame"></button></div>`;
    const m = openModal(`${dots}${body}
      <div class="m-actions">${this.step ? `<button class="btn" data-back>Назад</button>` : `<button class="btn ghost" data-skip>Пропустить</button>`}
        <button class="btn primary" data-next>${this.step === steps - 1 ? "Начать работу" : "Дальше"}</button></div>`, "onboarding");
    const save = () => m.querySelectorAll("[data-k]").forEach(i => { d[i.dataset.k] = i.dataset.k === "name" ? i.value.trim() : parseMoney(i.value); });
    m.querySelectorAll("#obTheme [data-v]").forEach(b => b.onclick = () => { d.theme = b.dataset.v; Store.settings.theme = d.theme; applyTheme(); this.open(); });
    m.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { d.accent = b.dataset.c; Store.settings.accent = d.accent; applyTheme(); this.open(); });
    m.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { d.mode = b.dataset.m; this.open(); });
    m.querySelector("#obGame")?.addEventListener("click", () => { d.game = !d.game; this.open(); });
    m.querySelector("[data-back]")?.addEventListener("click", () => { save(); this.step--; this.open(); });
    m.querySelector("[data-skip]")?.addEventListener("click", () => { Store.settings.onboarded = true; Store.commit("settings"); closeModal(); });
    m.querySelector("[data-next]").onclick = () => {
      save();
      if (this.step < steps - 1) { this.step++; return this.open(); }
      Object.assign(Store.settings, {
        heroName: d.name || "Герой", monthlyGoal: d.goal || 70000, hourlyRate: d.rate || 1000, theme: d.theme, accent: d.accent,
        features: d.mode === "simple" ? { ...SIMPLE_FEATURES } : { ...DEFAULT_FEATURES }, showGame: d.game, onboarded: true,
      });
      Store.commit("settings"); applyTheme(); renderChrome(); closeModal(); showTab("orders");
      toast(d.name ? `Привет, ${d.name}!` : "Готово!", "Добавьте первый заказ кнопкой «+ Новый заказ»", "ok", "star");
    };
  },
};

/* ---------- обновления веб-версии (iPhone) ---------- */
const Updater = {
  reg: null, latest: null, reloading: false,
  get supported() { return !Store.native && "serviceWorker" in navigator && (location.protocol === "https:" || /[?&]sw\b/.test(location.search)); },
  async init() {
    if (!this.supported) return;
    navigator.storage?.persist?.();
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) { hadController = true; return; }   // первая установка — не перезагружаем
      this.onUpdated();
    });
    try { this.reg = await navigator.serviceWorker.register("sw.js"); } catch (e) { console.warn("SW", e); }
    this.check(false);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.check(false); });
    setInterval(() => this.check(false), 30 * 60 * 1000);
  },
  async remoteVersion() {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    return (await r.json()).version;
  },
  /** Сравнить версию на сайте с установленной; если новее — скачать (SW ставится сам и перезагружает страницу). */
  async check(manual) {
    if (!this.supported) return;
    try {
      this.latest = await this.remoteVersion();
      if (currentTab === "settings") SettingsView.renderUpdates?.();
      if (this.latest === APP_VERSION) { if (manual) toast("Установлена последняя версия", APP_VERSION, "ok", "check"); return; }
      if (manual) toast("Найдена новая версия", `${this.latest} — загружаю…`, "ok", "download");
      await this.reg?.update();
      if (manual) setTimeout(() => {
        if (!this.reloading) toast("Обновление ещё в пути", "GitHub раздаёт новую версию до 10 минут — проверьте чуть позже", "warn", "clock");
      }, 20000);
    } catch (e) {
      if (manual) toast("Не удалось проверить обновления", "Нет связи с сайтом", "err", "x");
    }
  },
  onUpdated() {
    const auto = Store.local.autoUpdate !== false;
    const busy = (document.activeElement && document.activeElement.matches("input, textarea")) || !$("#modal").hidden;
    if (auto && !busy) return this.reload();
    toast("Вышла новая версия COMLOG", "Перезапустите, чтобы применить", "ok", "download", { label: "Обновить", run: () => this.reload() });
  },
  async reload() { this.reloading = true; await Store.save(true); location.reload(); },
};

boot();
