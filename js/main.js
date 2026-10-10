/* Точка входа: вкладки, тема, общие элементы, запуск на ПК и в браузере/iPhone. */
const TABS = {
  orders: { title: "Заказы", icon: "list", view: OrdersView },
  analytics: { title: "Аналитика", icon: "chart", view: AnalyticsView },
  clients: { title: "Клиенты", icon: "users", view: ClientsView },
  pricelist: { title: "Прайс-лист", icon: "tag", view: PriceListView },
  hero: { title: "Герой", icon: "user", view: HeroView, game: true },
  shop: { title: "Магазин", icon: "shop", view: ShopView, game: true },
  achievements: { title: "Достижения", icon: "trophy", view: AchievementsView },
  settings: { title: "Настройки", icon: "gear", view: SettingsView },
};
let currentTab = "orders";

function tabTitle(name) { return name === "achievements" && !Store.settings.showGame ? "Летопись" : TABS[name].title; }

function showTab(name) {
  if (!TABS[name] || (TABS[name].game && !Store.settings.showGame)) name = "orders";
  currentTab = name;
  $$("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
  $("#pageTitle").textContent = tabTitle(name);
  $("#bellPop").hidden = true;
  $("#moreSheet").hidden = true;
  AC.close();
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
  $("#nav").innerHTML = ["orders", "analytics", "clients", "pricelist"].map(k => btn(k)).join("") + `<div class="nav-sep"></div>`
    + (game ? btn("hero") + btn("shop") : "") + btn("achievements") + `<div class="nav-sep"></div>` + btn("settings");
  // мобильная панель: 4 главные вкладки + «Ещё»
  const main = ["orders", "analytics", "clients", game ? "hero" : "pricelist"];
  $("#mnav").innerHTML = main.map(k => btn(k)).join("") + `<button id="moreBtn">${icon("dots")}<span>Ещё</span></button>`;
  $("#moreSheet").innerHTML = `<div class="more-list">${Object.keys(TABS).filter(k => !main.includes(k) && (!TABS[k].game || game)).map(k => btn(k)).join("")}</div>`;
  $$("[data-tab]").forEach(b => b.onclick = () => showTab(b.dataset.tab));
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
    if (reason === "restore" || reason === "sync") {
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
  $("#syncBadge").onclick = () => showTab("settings");
  $("#modal").addEventListener("mousedown", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !AC.isOpen()) { if (!$("#modal").hidden) closeModal(); $("#bellPop").hidden = true; }
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyN") { e.preventDefault(); if (currentTab !== "orders") showTab("orders"); OrdersView.add(); }
  });

  setTimeout(checkReminders, 1200);
  setInterval(checkReminders, 10 * 60 * 1000);
  scheduleWindowsReminders();
  let day = todayISO();
  setInterval(() => {
    if (todayISO() !== day) { day = todayISO(); evaluateGame(); renderChrome(); if (currentTab === "orders") OrdersView.render(); checkReminders(); scheduleWindowsReminders(); }
  }, 60 * 1000);
  window.addEventListener("beforeunload", () => Store.save(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Store.save(true); });
  Sync.start();

  // офлайн-режим и установка на экран «Домой» — только для веб-версии
  if (!Store.native && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(e => console.warn("SW", e));
    navigator.storage?.persist?.();
  }
}

boot();
