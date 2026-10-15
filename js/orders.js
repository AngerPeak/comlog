/* Вкладка «Заказы»: помесячный журнал — таблица с редактированием на месте или доска-канбан. */
const BOARD_COLS = [
  { id: "work", title: "В работе", hint: "не выполнены", test: o => !o.done },
  { id: "wait", title: "Ждут оплаты", hint: "сданы, есть долг", test: o => o.done && debtOf(o) > 0 },
  { id: "paid", title: "Оплачено", hint: "сданы и оплачены", test: o => o.done && debtOf(o) === 0 },
];

const OrdersView = {
  month: monthKey(todayISO()),
  filter: "all",
  search: "",
  boardTab: "work",

  day: null,              // фильтр по дню (клик в «Дедлайнах на неделе» или в календаре)
  sort: { key: "", dir: 1 },
  widths: {},             // ширина столбцов, перетаскивается мышкой

  /** Интерфейсные настройки этого устройства: фильтр, сортировка, ширина столбцов, раскрытые подзадачи. */
  loadUI() {
    const ui = Store.local.ui || {};
    this.filter = ui.filter || "all";
    this.sort = ui.sort || { key: "", dir: 1 };
    this.widths = ui.widths || {};
    this.expanded = new Set(ui.expanded || []);
    this.boardTab = ui.boardTab || "work";
  },
  saveUI() {
    clearTimeout(this._uiTimer);
    this._uiTimer = setTimeout(() => {
      Store.local.ui = { ...(Store.local.ui || {}), filter: this.filter, sort: this.sort, widths: this.widths, expanded: [...this.expanded].slice(-200), boardTab: this.boardTab };
      Store.saveLocal();
    }, 400);
  },

  mount() {
    this.loadUI();
    const el = $("#page-orders");
    el.innerHTML = `
      <div class="row wrap">
        <div class="month-nav">
          <button class="icon-btn" data-m="-1" title="Предыдущий месяц">${icon("chev-l")}</button>
          <button class="mn-title" id="mnTitle" title="Выбрать месяц"></button>
          <button class="icon-btn" data-m="1" title="Следующий месяц">${icon("chev-r")}</button>
          <button class="btn sm ghost" id="mnToday">Сегодня</button>
        </div>
        <div class="spacer"></div>
        <div class="seg" id="oView"></div>
      </div>
      <div class="kpis" id="oKpis"></div>
      <div class="week-row">
        <div class="card"><h3>${icon("cal")}Дедлайны на неделе<span class="sub" id="weekSub"></span></h3><div class="week" id="weekStrip"></div></div>
        <div class="card"><h3>${icon("bell")}Ближайшие сроки<span class="sub">все месяцы</span></h3><div class="upcoming" id="upcoming"></div></div>
      </div>
      <div class="toolbar">
        <div class="search">${icon("search")}<input class="field" id="oSearch" placeholder="Поиск по всем месяцам" autocomplete="off"></div>
        <div class="seg" id="oFilter">
          <button data-f="all" class="on">Все</button><button data-f="undone">Не выполнены</button><button data-f="unpaid">Не оплачены</button>
        </div>
        <div class="split">
          <button class="btn primary" id="addOrder" title="Новый заказ (Ctrl+N)">${icon("plus")}<span class="lbl">Новый заказ</span></button>
          <button class="btn primary split-more" id="addMore" title="Ещё способы">${icon("chev-d")}</button>
        </div>
        <div class="spacer"></div>
        <span class="muted" id="oCount"></span>
      </div>
      <div id="oScope"></div>
      <div class="card table-card" id="oTableCard">
        <table class="orders">
          <colgroup id="oCols"></colgroup>
          <thead id="oHead"></thead>
          <tbody id="oBody"></tbody>
        </table>
        <div id="oEmpty"></div>
        <div class="table-foot" id="oFoot"></div>
      </div>
      <div id="oBoard" hidden></div>
      <div id="oCal" hidden></div>`;

    el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { this.month = shiftMonth(this.month, +b.dataset.m); this.day = null; this.render(); });
    $("#mnTitle").onclick = e => MonthPicker.open(e.currentTarget, this.month, k => { this.month = k; this.day = null; this.render(); });
    $("#mnToday").onclick = () => { this.month = monthKey(todayISO()); this.day = null; this.render(); };
    $("#addOrder").onclick = () => this.add();
    $("#addMore").onclick = e => this.moreMenu(e.currentTarget);
    $("#oSearch").oninput = e => { this.search = e.target.value.trim().toLowerCase(); this.renderList(); };
    $$("#oFilter button").forEach(b => b.onclick = () => { this.filter = b.dataset.f; this.saveUI(); this.renderList(); });
    $("#oView").addEventListener("click", e => {
      const b = e.target.closest("[data-v]");
      if (!b) return;
      if (isMobile()) { Store.local.mobileView = b.dataset.v; Store.saveLocal(); }
      else { Store.settings.ordersView = b.dataset.v; Store.commit("settings"); }
      this.renderList();
    });
    $("#oHead").addEventListener("click", e => {
      const th = e.target.closest("[data-sort]");
      if (!th || e.target.closest(".rz")) return;
      const k = th.dataset.sort;
      this.sort = this.sort.key !== k ? { key: k, dir: k === "date" ? -1 : 1 } : this.sort.dir === (k === "date" ? -1 : 1) ? { key: k, dir: -this.sort.dir } : { key: "", dir: 1 };
      this.saveUI(); this.renderList();
    });
    $("#oHead").addEventListener("pointerdown", e => this.startResize(e));
    this.bindTable();
    this.bindBoard();
    this.bindCalendar();
    window.matchMedia("(max-width: 760px)").addEventListener("change", () => currentTab === "orders" && this.renderList());
  },

  /** Вид: на ПК — таблица/доска/календарь (настройка), на телефоне — карточки или календарь. */
  get view() {
    const cal = feat("calendar");
    if (isMobile()) return Store.local.mobileView === "calendar" && cal ? "calendar" : "board";
    const v = Store.settings.ordersView;
    return v === "calendar" && !cal ? "table" : v;
  },

  render() {
    $("#mnTitle").innerHTML = `${monthTitle(this.month)}${icon("chev-d")}`;
    this.renderList();
  },

  /** Что показывать: месяц; при фильтре — ещё и хвосты прошлых месяцев; при поиске — все месяцы; при выборе дня — этот день. */
  visible() {
    const q = this.search, start = monthStart(this.month), end = monthEnd(this.month);
    const f = this.filter === "undone" ? (o => !o.done) : this.filter === "unpaid" ? (o => debtOf(o) > 0 || (!o.paid && !o.price)) : null;
    let list;
    if (q) list = Store.orders.filter(o => (o.client + " " + o.service + " " + (o.note || "")).toLowerCase().includes(q));
    else if (this.day) list = Store.orders.filter(o => o.deadline === this.day || (o.date === this.day && !o.dateUnknown));
    else if (f) list = Store.orders.filter(o => o.date <= end);
    else list = Store.orders.filter(o => o.date >= start && o.date <= end);
    if (f) list = list.filter(f);
    const { key, dir } = this.sort;
    const val = o => key === "date" ? o.date + (o.dateUnknown ? "" : "~") : key === "deadline" ? (o.deadline ? o.deadline + (o.deadlineTime || "~") : "") :
      key === "client" || key === "service" ? o[key].trim().toLowerCase() : key === "done" ? +o.done : key === "paid" ? +o.paid : o[key];
    const byKey = (a, b) => {
      const x = val(a), y = val(b);
      if (key === "deadline" && (!x || !y)) return x ? -1 : y ? 1 : 0;   // без срока — всегда в конце
      return (typeof x === "string" ? x.localeCompare(y, "ru") : x - y) * dir;
    };
    const byDefault = (a, b) => (a.dateUnknown - b.dateUnknown) || b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
    const byMonth = (a, b) => monthKey(b.date).localeCompare(monthKey(a.date));
    return list.sort((a, b) => (this.groups ? byMonth(a, b) : 0) || (key ? byKey(a, b) : 0) || byDefault(a, b));
  },
  get crossMonth() { return !!this.search || this.filter !== "all" || !!this.day; },
  get groups() { return this.crossMonth && !this.day; },

  renderList() {
    $$("#oFilter button").forEach(x => x.classList.toggle("on", x.dataset.f === this.filter));
    const views = isMobile() ? [["board", "board", "Карточки"]] : [["table", "table", "Таблица"], ["board", "board", "Доска"]];
    if (feat("calendar")) views.push(["calendar", "cal", "Календарь"]);
    $("#oView").innerHTML = views.length > 1 ? views.map(([v, ic, l]) => `<button data-v="${v}" class="${this.view === v ? "on" : ""}" title="${l}">${icon(ic)}<span class="lbl">${l}</span></button>`).join("") : "";
    $("#oView").hidden = views.length < 2;
    const view = this.view, list = this.visible();
    $("#oTableCard").hidden = view !== "table";
    $("#oBoard").hidden = view !== "board";
    $("#oCal").hidden = view !== "calendar";
    const other = this.groups ? list.filter(o => monthKey(o.date) !== this.month).length : 0;
    $("#oScope").innerHTML = this.day
      ? `<div class="scope-note">${icon("cal")} Сроки и заказы на ${longDate(this.day)}: ${list.length} <button class="btn sm ghost" id="dayReset">${icon("x")} Показать весь месяц</button></div>`
      : this.search ? `<div class="scope-note">${icon("search")} Поиск по всем месяцам: найдено ${list.length}</div>`
      : other ? `<div class="scope-note">${icon("clock")} Учтены хвосты прошлых месяцев: ${other} ${plural(other, "заказ", "заказа", "заказов")}</div>` : "";
    $("#dayReset")?.addEventListener("click", () => { this.day = null; this.renderList(); });
    if (view === "board") this.renderBoard(list);
    else if (view === "calendar") this.renderCalendar();
    else this.renderTable(list);
    this.renderSummary(list);
  },

  /* ---------- таблица ---------- */
  COLS: [["date", "Дата"], ["client", "Клиент"], ["service", "Услуга"], ["price", "Прайс", "r"], ["received", "Получено", "r"],
    ["done", "Выполнен", "c-chk"], ["paid", "Оплачен", "c-chk"], ["deadline", "Дедлайн"]],
  renderHead() {
    const def = { date: 100, client: null, service: null, price: 100, received: 100, done: 76, paid: 76, deadline: 146 };
    $("#oCols").innerHTML = this.COLS.map(([k]) => {
      const w = this.widths[k] || def[k];
      return `<col class="c-${k === "price" || k === "received" ? "money" : k === "done" || k === "paid" ? "chk" : k === "deadline" ? "dl" : k}" data-col="${k}" ${w ? `style="width:${w}px"` : ""}>`;
    }).join("") + `<col class="c-act">`;
    // минимальная ширина: все фиксированные столбцы + место под услугу; лишнее — прокрутка внутри карточки
    const fixed = this.COLS.reduce((s, [k]) => s + (k === "service" ? 0 : (this.widths[k] || def[k] || 120)), 0) + 138;
    $("#oTableCard table").style.minWidth = fixed + 180 + "px";
    $("#oHead").innerHTML = `<tr>${this.COLS.map(([k, l, cls]) => {
      const on = this.sort.key === k;
      return `<th class="col-${k} ${cls || ""} sortable ${on ? "sorted" : ""}" data-sort="${k}" title="Сортировать">${l}${on ? `<i class="sort-arrow">${this.sort.dir > 0 ? "▲" : "▼"}</i>` : ""}${k !== "service" ? `<i class="rz" data-rz="${k}" title="Потяните, чтобы изменить ширину"></i>` : ""}</th>`;
    }).join("")}<th class="col-act">${Object.keys(this.widths).length ? `<button class="mini-ico" id="colsReset" title="Вернуть ширину столбцов">${icon("x")}</button>` : ""}</th></tr>`;
    $("#colsReset")?.addEventListener("click", () => { this.widths = {}; this.saveUI(); this.renderList(); });
  },
  startResize(e) {
    const h = e.target.closest(".rz");
    if (!h) return;
    e.preventDefault(); e.stopPropagation();
    const k = h.dataset.rz, col = $(`#oCols col[data-col="${k}"]`), th = h.closest("th");
    const x0 = e.clientX, w0 = th.getBoundingClientRect().width;
    document.body.classList.add("resizing");
    const move = ev => { const w = Math.max(56, Math.min(600, Math.round(w0 + ev.clientX - x0))); col.style.width = w + "px"; this.widths[k] = w; };
    const up = () => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", up); document.body.classList.remove("resizing"); this.saveUI(); this.renderHead(); };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  },
  renderTable(list) {
    const card = $("#oTableCard");
    card.classList.toggle("colored", !!Store.settings.colorColumns);
    card.classList.toggle("compact", Store.settings.density === "compact");
    this.renderHead();
    let html = "", lastMonth = null;
    for (const o of list) {
      const mk = monthKey(o.date);
      if (this.groups && mk !== lastMonth) {
        const n = list.filter(x => monthKey(x.date) === mk).length;
        html += `<tr class="grp"><td colspan="9">${monthTitle(mk)} <span>${n} ${plural(n, "заказ", "заказа", "заказов")}</span></td></tr>`;
        lastMonth = mk;
      }
      html += this.rowHTML(o);
    }
    $("#oBody").innerHTML = html;
    const total = ordersInMonth(this.month).length;
    $("#oEmpty").innerHTML = list.length ? "" : this.emptyHTML(total);
  },
  emptyHTML(total) {
    const nothing = !this.crossMonth && !total;
    return `<div class="empty-state"><div class="es-ico">${icon(nothing ? "list" : "search")}</div>
      <h4>${nothing ? "В этом месяце пока нет заказов" : this.day ? "На этот день ничего нет" : this.filter !== "all" && !this.search ? "Хвостов нет — всё закрыто 👌" : "Ничего не найдено"}</h4>
      <div>${nothing ? "Нажмите «Новый заказ» или Ctrl+N" : "Попробуйте изменить фильтр или поиск"}</div></div>`;
  },

  rowHTML(o) {
    const color = serviceColor(o.service);
    const dateTitle = o.dateUnknown ? "Дата не указана — нажмите, чтобы выбрать" : longDate(o.date);
    const multi = o.payments.length > 1;
    const contact = clientContact(o.client);
    return `<tr data-id="${o.id}" class="${o.done ? "is-done" : ""} ${o.paid ? "is-paid" : ""} ${monthKey(o.date) !== this.month ? "is-other" : ""}">
      <td class="col-date"><span class="date-chip ${o.dateUnknown ? "unknown" : ""}" data-act="pick" title="${dateTitle}">${orderDateLabel(o, this.crossMonth)}<input type="date" class="hidden-date" data-f="date" value="${o.date}" tabindex="-1"></span></td>
      <td class="col-client"><div class="svc"><input class="cell-in t-client" data-f="client" data-ac="client" value="${esc(o.client)}" placeholder="Имя клиента" spellcheck="false" autocomplete="off">${contact ? `<a class="ct-btn" href="${esc(contact)}" target="_blank" rel="noopener" title="Написать клиенту">${icon("send")}</a>` : ""}</div></td>
      <td class="col-service"><div class="svc ${color ? "has" : ""}" style="${color ? `--svc:${color}` : ""}"><input class="cell-in t-service" data-f="service" data-ac="service" value="${esc(o.service)}" placeholder="Наименование услуги" spellcheck="false" autocomplete="off">${noteBtn(o)}${timerBtn(o)}${trackBtn(o)}${subBtn(o)}</div></td>
      <td class="col-price"><input class="cell-in money ${o.hourly ? "auto" : ""}" data-f="price" value="${o.price ? fmt(o.price) : ""}" placeholder="0" inputmode="numeric" ${o.hourly ? `readonly title="Почасовая: ${fmt(o.rate)} ₽/ч × ${fmtDur(timerElapsed(o))}. Ставка и время — в карточке заказа (⋯)"` : ""}></td>
      <td class="col-received"><div class="got">${multi ? `<button class="pay-count" data-act="edit" title="Платежей: ${o.payments.length}">${o.payments.length}</button>` : ""}<input class="cell-in money money-got" data-f="received" value="${o.received ? fmt(o.received) : ""}" placeholder="0" inputmode="numeric"></div></td>
      <td class="col-done c-chk"><button class="chk done ${o.done ? "on" : ""}" data-act="done" title="Заказ выполнен">${icon("check")}</button></td>
      <td class="col-paid c-chk"><button class="chk pay ${o.paid ? "on" : ""}" data-act="paid" title="Оплачен — остаток добавится платежом">${icon("check")}</button></td>
      <td class="col-deadline"><div class="dl">${deadlineChip(o)}${deadlineBadge(o)}</div></td>
      <td><div class="acts">
        <button class="mini-ico" data-act="repeat" title="Повторить заказ (Ctrl+D)">${icon("copy")}</button>
        <button class="mini-ico ${o.remind ? "bell-on" : ""}" data-act="remind" title="${o.remind ? "Напоминание включено" : "Напоминание выключено"}">${icon("bell")}</button>
        <button class="mini-ico" data-act="edit" title="Подробнее: оплаты, дата, заметка">${icon("dots")}</button>
        <button class="mini-ico del" data-act="del" title="Удалить заказ">${icon("trash")}</button>
      </div></td></tr>${this.expanded.has(o.id) && feat("subtasks") ? `<tr class="sub-tr" data-sub-of="${o.id}"><td colspan="2"></td><td colspan="7">${subListHTML(o)}</td></tr>` : ""}`;
  },
  expanded: new Set(),   // у каких заказов раскрыт список подзадач

  /** Общие действия для строки таблицы и карточки доски. */
  act(o, act, btn) {
    if (act === "pick") { const inp = btn.querySelector("input"); try { inp.showPicker(); } catch { inp.focus(); } return; }
    if (act === "done") { o.done = !o.done; o.doneDate = o.done ? todayISO() : null; if (o.done && o.timerStart) { stopTimer(o); renderTimerPill(); } }
    if (act === "paid") setPaid(o, !o.paid);
    if (act === "remind") { o.remind = !o.remind; toast(o.remind ? "Напоминание включено" : "Напоминание выключено", o.service || o.client || "", "ok", "bell"); }
    if (act === "del") return this.remove(o);
    if (act === "repeat") return this.repeat(o);
    if (act === "timer") return toggleTimer(o);
    if (act === "track") return toggleTrackUI(o);
    if (act === "dl") return DeadlinePop.open(btn, o);
    if (act === "subs") return this.toggleSubs(o);
    if (act === "edit") return OrderSheet.open(o.id);
    Store.commit("orders");
    this.refreshItem(o);
  },
  refreshItem(o) {
    if (this.view === "board") return this.renderList();
    const tr = $(`#oBody tr[data-id="${o.id}"]`);
    if (!tr) return;
    const focused = document.activeElement && tr.contains(document.activeElement) ? document.activeElement.dataset.f : null;
    const sub = tr.nextElementSibling;
    if (sub && sub.dataset.subOf === o.id) sub.remove();
    tr.insertAdjacentHTML("afterend", this.rowHTML(o));
    tr.remove();
    if (focused) $(`#oBody tr[data-id="${o.id}"] [data-f="${focused}"]`)?.focus();
  },
  /** Раскрыть/свернуть подзадачи под заказом; пустой список сразу открывается с полем ввода. */
  toggleSubs(o) {
    const open = !this.expanded.has(o.id);
    if (open) this.expanded.add(o.id); else this.expanded.delete(o.id);
    this.saveUI();
    this.refreshItem(o);
    if (open) $(`[data-sub-of="${o.id}"] [data-s="new"]`)?.focus();
  },

  bindTable() {
    const body = $("#oBody");
    body.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      const tr = btn && btn.closest("tr[data-id]"), o = tr && Store.order(tr.dataset.id);
      if (o) this.act(o, btn.dataset.act, btn);
    });
    body.addEventListener("focusin", e => {
      const f = e.target.dataset.f;
      if (f === "price" || f === "received") { e.target.value = e.target.value.replace(/\s/g, ""); e.target.select(); }
    });
    body.addEventListener("input", e => {
      const inp = e.target, f = inp.dataset.f, tr = inp.closest("tr"), o = tr && Store.order(tr.dataset.id);
      if (!o || !f) return;
      if (f === "client" || f === "service") o[f] = inp.value;
      if (f === "price") { setPrice(o, parseMoney(inp.value)); this.syncRowMoney(tr, o, "received"); }
      if (f === "received") { setReceived(o, parseMoney(inp.value)); this.syncRowMoney(tr, o, null); }
      this.renderSummary();
      Store.save();
    });
    body.addEventListener("change", e => {
      const inp = e.target, f = inp.dataset.f, tr = inp.closest("tr"), o = tr && Store.order(tr.dataset.id);
      if (!o || !f) return;
      if (f === "date") {
        if (!inp.value) { inp.value = o.date; return; }
        o.date = inp.value; o.dateUnknown = false;
        if (monthKey(o.date) !== this.month && !this.crossMonth) toast("Заказ перенесён", `в ${monthTitle(monthKey(o.date))}`, "ok", "cal");
        Store.commit("orders"); this.renderList(); return;
      }
      if (f === "deadline") { o.deadline = inp.value || null; this.refreshItem(o); Store.commit("orders"); return; }
      if (f === "client" || f === "service") {
        o[f] = inp.value.trim();
        if (!o.price && !o.hourly) {
          const p = suggestPrice(o.client, o.service);
          if (p) { setPrice(o, p); const pi = tr.querySelector('[data-f="price"]'); if (pi && document.activeElement !== pi) pi.value = fmt(p); this.syncRowMoney(tr, o, "received"); }
        }
        if (f === "service") { const w = tr.querySelector(".svc"), c = serviceColor(o.service); w.classList.toggle("has", !!c); w.style.cssText = c ? `--svc:${c}` : ""; }
      }
      Store.commit("orders");
    });
    body.addEventListener("focusout", e => {
      const f = e.target.dataset.f, tr = e.target.closest("tr"), o = tr && Store.order(tr.dataset.id);
      if (!o || (f !== "price" && f !== "received")) return;
      e.target.value = o[f] ? fmt(o[f]) : "";
      Store.commit("orders");
      setTimeout(() => { if (!tr.contains(document.activeElement)) this.refreshItem(o); }, 0);
    });
    body.addEventListener("focusin", e => { const tr = e.target.closest("tr[data-id]"); if (tr) this.lastRow = tr.dataset.id; });
    body.addEventListener("pointerdown", e => { const tr = e.target.closest("tr[data-id]"); if (tr) this.lastRow = tr.dataset.id; });
    body.addEventListener("keydown", e => {
      // стрелки вверх/вниз — то же поле в соседней строке
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.target.matches(".cell-in") && !AC.isOpen()) {
        const rows = $$("#oBody tr[data-id]"), tr = e.target.closest("tr[data-id]");
        const next = rows[rows.indexOf(tr) + (e.key === "ArrowDown" ? 1 : -1)];
        const inp = next && next.querySelector(`[data-f="${e.target.dataset.f}"]`);
        if (inp) { e.preventDefault(); inp.focus(); }
        return;
      }
      if (e.key === "Enter" && e.target.matches(".cell-in") && !AC.isOpen()) {
        const inputs = $$(".cell-in", e.target.closest("tr"));
        const i = inputs.indexOf(e.target);
        if (i < inputs.length - 1) inputs[i + 1].focus(); else e.target.blur();
      }
      if (e.key === "Escape" && !AC.isOpen()) e.target.blur();
    });
  },
  syncRowMoney(tr, o, field) {
    tr.classList.toggle("is-paid", o.paid);
    tr.querySelector('[data-act="paid"]').classList.toggle("on", o.paid);
    if (field) { const inp = tr.querySelector(`[data-f="${field}"]`); if (inp && document.activeElement !== inp) inp.value = o[field] ? fmt(o[field]) : ""; }
  },

  /* ---------- доска ---------- */
  renderBoard(list) {
    const mob = isMobile();
    const cols = BOARD_COLS.map(c => ({ ...c, items: list.filter(c.test) }));
    cols[0].items.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
    $("#oBoard").innerHTML = `
      ${mob ? `<div class="seg board-tabs">${cols.map(c => `<button data-bt="${c.id}" class="${this.boardTab === c.id ? "on" : ""}">${c.title} <em>${c.items.length}</em></button>`).join("")}</div>` : ""}
      <div class="board ${mob ? "single" : ""}">${cols.map(c => `
        <div class="bcol ${mob && this.boardTab !== c.id ? "hidden-col" : ""}" data-col="${c.id}">
          <div class="bcol-head"><b>${c.title}</b><span class="muted">${c.hint}</span><em>${c.items.length}</em></div>
          <div class="bcol-sum">${money(c.items.reduce((s, o) => s + (c.id === "paid" ? o.received : c.id === "wait" ? debtOf(o) : o.price), 0))}</div>
          <div class="bcol-list">${c.items.map(o => this.cardHTML(o)).join("") || `<div class="bcol-empty">Пусто</div>`}</div>
        </div>`).join("")}
      </div>`;
    $$("#oBoard [data-bt]").forEach(b => b.onclick = () => { this.boardTab = b.dataset.bt; this.saveUI(); this.renderList(); });
  },
  cardHTML(o) {
    const color = serviceColor(o.service);
    return `<div class="kcard" draggable="true" data-id="${o.id}" style="${color ? `--svc:${color}` : ""}">
      <div class="kc-top"><span class="date-chip ${o.dateUnknown ? "unknown" : ""}">${orderDateLabel(o, this.crossMonth)}</span>
        ${o.deadline ? `<span class="date-chip" title="Дедлайн">${icon("clock")}${shortDate(o.deadline)}${o.deadlineTime ? " · " + o.deadlineTime : ""}</span>${deadlineBadge(o)}` : ""}</div>
      <div class="kc-client">${esc(o.client || "Без имени")}${clientContact(o.client) ? `<a class="ct-btn" href="${esc(clientContact(o.client))}" target="_blank" rel="noopener" title="Написать клиенту">${icon("send")}</a>` : ""}</div>
      <div class="kc-service">${color ? `<i class="dot" style="background:${color}"></i>` : ""}${esc(o.service || "Услуга не указана")}${noteBtn(o)}</div>
      <div class="kc-foot">
        <span class="kc-money"><b>${money(o.price)}</b>${o.received && o.received < o.price ? `<small>получено ${money(o.received)}</small>` : ""}</span>
        ${timerBtn(o)}${trackBtn(o)}${subBtn(o)}
        <button class="mini-ico" data-act="repeat" title="Повторить">${icon("copy")}</button>
        <button class="chk done ${o.done ? "on" : ""}" data-act="done" title="Выполнен">${icon("check")}</button>
        <button class="chk pay ${o.paid ? "on" : ""}" data-act="paid" title="Оплачен"><b class="rub">₽</b></button>
      </div>${this.expanded.has(o.id) && feat("subtasks") ? `<div class="kc-subs" data-sub-of="${o.id}">${subListHTML(o)}</div>` : ""}</div>`;
  },
  bindBoard() {
    const b = $("#oBoard");
    b.addEventListener("click", e => {
      const card = e.target.closest(".kcard");
      if (!card || e.target.closest(".kc-subs, a")) return;   // подзадачи и ссылки обрабатываются отдельно
      const o = Store.order(card.dataset.id);
      const btn = e.target.closest("[data-act]");
      if (btn) this.act(o, btn.dataset.act, btn); else OrderSheet.open(o.id);
    });
    let dragId = null;
    b.addEventListener("dragstart", e => { const c = e.target.closest(".kcard"); if (!c) return; dragId = c.dataset.id; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
    b.addEventListener("dragend", e => { e.target.closest?.(".kcard")?.classList.remove("dragging"); $$(".bcol.over").forEach(x => x.classList.remove("over")); });
    b.addEventListener("dragover", e => { const col = e.target.closest(".bcol"); if (!col || !dragId) return; e.preventDefault(); $$(".bcol.over").forEach(x => x !== col && x.classList.remove("over")); col.classList.add("over"); });
    b.addEventListener("drop", e => {
      const col = e.target.closest(".bcol"), o = dragId && Store.order(dragId);
      dragId = null;
      if (!col || !o) return;
      e.preventDefault();
      const to = col.dataset.col;
      if (to === "work") { o.done = false; o.doneDate = null; }
      else {
        if (!o.done) { o.done = true; o.doneDate = todayISO(); }
        if (o.timerStart) { stopTimer(o); renderTimerPill(); }
        if (to === "paid" && debtOf(o) > 0) setPaid(o, true);
        if (to === "wait" && debtOf(o) === 0 && o.price > 0) setPaid(o, false);
      }
      Store.commit("orders");
      this.renderList();
    });
  },

  /* ---------- создание / повтор / удаление ---------- */
  newDate() { const t = todayISO(); return monthKey(t) === this.month ? t : monthStart(this.month); },
  focusNew(o) {
    this.filter = "all"; this.search = ""; $("#oSearch").value = "";
    this.month = monthKey(o.date);
    this.render();
    if (this.view === "board") return OrderSheet.open(o.id);
    const tr = $(`#oBody tr[data-id="${o.id}"]`);
    if (tr) { tr.classList.add("flash"); tr.scrollIntoView({ block: "center", behavior: "smooth" }); tr.querySelector('[data-f="client"]').focus(); }
  },
  add(fields = {}) {
    const o = normalizeOrder({ date: this.newDate(), ...hourlyDefaults(fields), ...fields });
    Store.orders.push(o);
    Store.commit("orders");
    this.focusNew(o);
    return o;
  },
  /** n одинаковых заказов; prices — цены по штукам (для пакетов из прайс-листа). */
  addMany(base, n, prices = null) {
    const created = [];
    for (let i = 0; i < n; i++) {
      const o = normalizeOrder({ ...hourlyDefaults(base), ...base, ...(prices ? { price: prices[i] } : {}), createdAt: Date.now() + i });
      Store.orders.push(o); created.push(o);
    }
    Store.commit("orders");
    this.month = monthKey(base.date); this.filter = "all"; this.search = ""; $("#oSearch").value = "";
    this.render();
    created.forEach(o => $(`#oBody tr[data-id="${o.id}"]`)?.classList.add("flash"));
    toast(`Добавлено заказов: ${n}`, [base.client, base.service].filter(Boolean).join(" — "), "ok", "plus");
  },
  repeat(o) {
    const copy = normalizeOrder({ client: o.client, service: o.service, price: o.hourly ? 0 : o.price, hourly: o.hourly, rate: o.rate, remind: o.remind, date: this.newDate() });
    Store.orders.push(copy);
    Store.commit("orders");
    this.renderList();
    const el = $(`[data-id="${copy.id}"]`);
    if (el) { el.classList.add("flash"); el.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    toast("Заказ повторён", [o.client, o.service].filter(Boolean).join(" — "), "ok", "copy");
  },
  async remove(o) {
    const name = [o.client, o.service].filter(Boolean).join(" — ") || "пустой заказ";
    const empty = !(o.client || o.service || o.price);
    if (!empty && !Store.settings.undoDelete && !await confirmBox("Удалить заказ?", name, "Удалить", true)) return;
    const idx = Store.orders.indexOf(o);
    Store.state.orders = Store.orders.filter(x => x !== o);
    Store.commit("orders");
    this.renderList();
    if (!empty && Store.settings.undoDelete) toast("Заказ удалён", name, "ok", "trash", {
      label: "Отменить",
      run: () => { Store.orders.splice(Math.min(idx, Store.orders.length), 0, o); Store.commit("orders"); this.renderList(); },
    });
  },

  moreMenu(anchor) {
    document.querySelector(".menu-pop")?.remove();
    const m = document.createElement("div");
    m.className = "menu-pop";
    m.innerHTML = `<button data-m="many">${icon("copy")}<span><b>Несколько одинаковых</b><small>например, 5 × «Сторис»</small></span></button>
      <button data-m="tpl">${icon("tag")}<span><b>Из прайс-листа</b><small>${Store.state.templates.length} ${plural(Store.state.templates.length, "шаблон", "шаблона", "шаблонов")}</small></span></button>`;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.top = r.bottom + 6 + "px";
    m.style.left = Math.min(window.innerWidth - m.offsetWidth - 8, r.right - m.offsetWidth) + "px";
    const close = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", close, true); } };
    setTimeout(() => document.addEventListener("pointerdown", close, true));
    m.onclick = e => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      m.remove(); document.removeEventListener("pointerdown", close, true);
      if (b.dataset.m === "many") this.manyDialog(); else this.templateDialog();
    };
  },
  manyDialog(pre = {}) {
    const m = openModal(`<h3>Несколько заказов</h3><p>Создаст одинаковые заказы — удобно для пачки сторис или обложек.</p>
      <div class="form-grid">
        <label>Клиент<input class="field" data-f="client" data-ac="client" value="${esc(pre.client || "")}" autocomplete="off"></label>
        <label>Услуга<input class="field" data-f="service" data-ac="service" value="${esc(pre.service || "")}" autocomplete="off"></label>
        <label>Прайс за штуку, ₽<input class="field" data-f="price" inputmode="numeric" value="${pre.price ? fmt(pre.price) : ""}"></label>
        <label>Количество<input class="field" data-f="count" type="number" min="1" max="99" value="${pre.count || 3}"></label>
        <label>Дата<input class="field" data-f="date" type="date" value="${this.newDate()}"></label>
        <label>Дедлайн <small class="muted">необязательно</small><input class="field" data-f="deadline" type="date"></label>
      </div>
      <div class="m-actions"><button class="btn" data-r="0">Отмена</button><button class="btn primary" data-r="1">${icon("plus")} Добавить</button></div>`, "wide");
    const val = f => m.querySelector(`[data-f="${f}"]`).value.trim();
    const fill = () => { const pi = m.querySelector('[data-f="price"]'); if (!parseMoney(pi.value)) { const p = suggestPrice(val("client"), val("service")); if (p) pi.value = fmt(p); } };
    m.querySelector('[data-f="service"]').addEventListener("change", fill);
    m.querySelector('[data-f="client"]').addEventListener("change", fill);
    m.querySelector('[data-r="0"]').onclick = closeModal;
    m.querySelector('[data-r="1"]').onclick = () => {
      const n = Math.max(1, Math.min(99, parseInt(val("count")) || 1));
      const base = { client: val("client"), service: val("service"), price: parseMoney(val("price")), date: val("date") || this.newDate(), deadline: val("deadline") || null };
      closeModal();
      this.addMany(base, n);
    };
  },
  templateDialog() {
    const tpls = Store.state.templates;
    if (!tpls.length) { toast("Прайс-лист пуст", "Создайте шаблоны во вкладке «Прайс-лист»", "warn", "tag"); return showTab("pricelist"); }
    const m = openModal(`<h3>Из прайс-листа</h3><p>Выберите шаблон и количество — заказы появятся в ${MONTHS_PREP[+this.month.slice(5) - 1]}.</p>
      <div class="tpl-pick">${tpls.map(t => `<div class="tpl-row" data-id="${t.id}">
        <i class="dot" style="background:${serviceColor(t.service) || "var(--line-2)"}"></i>
        <div class="tp-main"><b>${t.qty > 1 ? `Пакет: ${t.qty} × ` : ""}${esc(t.service)}</b><small>${t.client ? esc(t.client) + " · " : ""}${money(t.price)}${t.qty > 1 ? ` за пакет · ${money(Math.round(t.price / t.qty))}/шт` : ""}</small></div>
        <input class="field num-in" type="number" min="1" max="99" value="1">
        <button class="btn sm primary" data-add>${icon("plus")}</button></div>`).join("")}</div>
      <div class="m-actions"><button class="btn" data-r="0">Готово</button></div>`, "wide");
    m.querySelector('[data-r="0"]').onclick = closeModal;
    m.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
      const row = b.closest(".tpl-row"), t = tpls.find(x => x.id === row.dataset.id);
      const n = Math.max(1, Math.min(99, parseInt(row.querySelector("input").value) || 1));
      if (t.qty > 1) {
        const prices = Array.from({ length: n }, () => packagePrices(t.price, t.qty)).flat();
        this.addMany({ client: t.client, service: t.service, date: this.newDate() }, prices.length, prices);
      } else this.addMany({ client: t.client, service: t.service, price: t.price, date: this.newDate() }, n);
      b.innerHTML = icon("check");
    });
  },

  goTo(id) {
    const o = Store.order(id);
    if (!o) return;
    showTab("orders");
    this.month = monthKey(o.date); this.filter = "all"; this.search = ""; $("#oSearch").value = "";
    this.render();
    const el = $(`[data-id="${id}"]`, $("#page-orders"));
    if (el) { el.classList.add("flash"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
    if (this.view === "board") OrderSheet.open(id);
  },

  /* ---------- сводка ---------- */
  renderSummary(vis = this.visible()) {
    const st = rangeStats(monthStart(this.month), monthEnd(this.month));
    const s = Store.settings, goal = s.monthlyGoal, pctGoal = goal ? Math.min(100, (st.received / goal) * 100) : 0;
    const unpaid = st.list.filter(o => debtOf(o) > 0).length;
    const fc = forecastMonth(this.month);
    const prevName = MONTHS_SHORT[+shiftMonth(this.month, -1).slice(5) - 1];
    const cmp = fc.prev ? pct(fc.value, fc.prev) : null;
    const cmpHTML = cmp === null ? "" : `<span class="${cmp >= 0 ? "up" : "down"}">${cmp >= 0 ? "▲" : "▼"} ${Math.abs(cmp)}%</span> к ${prevName}`;
    $("#oKpis").innerHTML = `
      <div class="card kpi hero-kpi"><div class="k-label">${icon("coin")}Получено за месяц</div>
        <div class="k-val">${fmt(st.received)}<small>₽</small></div>
        ${goal ? `<div class="goalbar"><i style="width:${pctGoal}%"></i></div><div class="k-foot">${Math.round(pctGoal)}% от цели ${money(goal)}</div>` : ""}</div>
      <div class="card kpi"><div class="k-label">${icon("clock")}Долг за месяц</div>
        <div class="k-val ${st.debt ? "red" : ""}">${fmt(st.debt)}<small>₽</small></div>
        <div class="k-foot">${unpaid ? `${unpaid} ${plural(unpaid, "заказ ждёт", "заказа ждут", "заказов ждут")} оплаты` : "Все расчёты закрыты"}</div></div>
      <div class="card kpi"><div class="k-label">${icon("trend")}${fc.kind === "current" ? "Прогноз на месяц" : fc.kind === "past" ? "Итог месяца" : "Прогноз"}</div>
        <div class="k-val">${fc.kind === "future" ? "—" : `${fc.kind === "current" ? "≈ " : ""}${fmt(fc.value)}<small>₽</small>`}</div>
        <div class="k-foot">${fc.kind === "future" ? "месяц ещё не начался" : cmpHTML || "сравнивать пока не с чем"}</div></div>
      <div class="card kpi"><div class="k-label">${icon("check")}Выполнено</div>
        <div class="k-val">${st.done}<small>/ ${st.count}</small></div>
        <div class="k-foot">назначено ${money(st.price)}</div></div>
      ${s.taxEnabled ? `<div class="card kpi"><div class="k-label">${icon("receipt")}Налог ${s.taxRate}%</div>
        <div class="k-val">${fmt(st.tax)}<small>₽</small></div>
        <div class="k-foot">на руки ${money(st.received - st.tax)}</div></div>` : ""}
      ${feat("piggy") ? piggyKpiHTML() : ""}`;
    $("#oKpis .piggy-kpi")?.addEventListener("click", () => Piggy.open());

    const vs = { price: 0, received: 0, debt: 0 };
    vis.forEach(o => { vs.price += o.price; vs.received += o.received; vs.debt += debtOf(o); });
    $("#oCount").textContent = `${vis.length} ${plural(vis.length, "заказ", "заказа", "заказов")}`;
    $("#oFoot").innerHTML = vis.length ? `<span>Прайс: <b>${money(vs.price)}</b></span><span>Получено: <b class="lime">${money(vs.received)}</b></span><span>Долг: <b>${money(vs.debt)}</b></span>` : "";
    $("#oFoot").hidden = !vis.length;
    this.renderWeek();
    this.renderUpcoming();
  },

  renderWeek() {
    const t = todayISO(), ws = weekStart(t);
    let html = "", total = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const dls = Store.orders.filter(o => o.deadline === d && !o.done);
      const made = Store.orders.filter(o => o.date === d && !o.dateUnknown);
      total += dls.length;
      const dots = [...dls.slice(0, 3).map(() => `<i class="${d < t ? "r" : "l"}"></i>`), ...(made.length && dls.length < 3 ? ["<i></i>"] : [])].join("");
      const tip = dls.map(o => `⏰ ${o.client || "—"}: ${o.service || "—"}`).concat(made.map(o => `• ${o.client || "—"}: ${o.service || "—"}`)).join("\n");
      html += `<div class="day ${d === t ? "today" : ""} ${this.day === d ? "picked" : ""}" data-day="${d}" title="${esc(tip || longDate(d))}"><div class="dots">${dots}</div>
        <div class="d-w">${WEEKDAYS[i]}</div><div class="d-n">${parseISO(d).getDate()}</div></div>`;
    }
    $("#weekStrip").innerHTML = html;
    $$("#weekStrip [data-day]").forEach(el => el.onclick = () => {
      this.day = this.day === el.dataset.day ? null : el.dataset.day;
      if (this.day) this.month = monthKey(this.day);
      this.render();
      $("#oScope").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#weekSub").textContent = total ? `${total} ${plural(total, "срок", "срока", "сроков")}` : "свободно";
  },

  renderUpcoming() {
    const list = upcomingDeadlines(21);
    $("#upcoming").innerHTML = list.length ? list.map(o => `
      <div class="up-item" data-go="${o.id}"><div class="up-main"><b>${esc(o.client || "Без имени")}</b> <span class="muted">· ${esc(o.service || "—")}</span></div>
        <span class="date-chip">${shortDate(o.deadline)}</span>${deadlineBadge(o)}</div>`).join("")
      : `<div class="muted" style="padding:14px 8px">Ближайших дедлайнов нет — можно выдохнуть</div>`;
    $$("#upcoming [data-go]").forEach(el => el.onclick = () => this.goTo(el.dataset.go));
  },
};

/** Прогноз: темп текущего месяца, сглаженный средним за 3 прошлых месяца. */
function forecastMonth(key) {
  const cur = monthKey(todayISO());
  const recv = k => rangeStats(monthStart(k), monthEnd(k)).received;
  const value = recv(key), prev = recv(shiftMonth(key, -1));
  if (key > cur) return { kind: "future", value: 0, prev };
  if (key < cur) return { kind: "past", value, prev };
  const day = new Date().getDate(), dim = parseISO(monthEnd(key)).getDate();
  const past = [1, 2, 3].map(i => recv(shiftMonth(key, -i))).filter(v => v > 0);
  const avg3 = past.length ? past.reduce((a, b) => a + b, 0) / past.length : 0;
  const pace = (value / day) * dim, w = day / dim;
  const est = avg3 ? w * pace + (1 - w) * avg3 : pace;
  return { kind: "current", value: Math.max(value, Math.round(est / 100) * 100), prev };
}

function deadlineBadge(o) {
  if (!o.deadline) return "";
  if (o.done) return o.doneDate && o.doneDate <= o.deadline ? `<span class="tag lime">вовремя</span>` : `<span class="tag mute">сдан</span>`;
  const d = daysBetween(todayISO(), o.deadline), rd = Store.settings.remindDays;
  if (d < 0) return `<span class="tag red">−${-d} дн</span>`;
  if (d === 0) return `<span class="tag orange">сегодня</span>`;
  if (d === 1) return `<span class="tag orange">завтра</span>`;
  if (d <= rd) return `<span class="tag orange">${d} дн</span>`;
  return `<span class="tag mute">${d} дн</span>`;
}

/* ---------- таймер почасовой оплаты ---------- */
/** Почасовая оплата: включена у заказа или общим переключателем для всех невыполненных. */
function hourlyOn(o) { return feat("hourly") && (o.hourly || (Store.settings.hourlyAll && !o.done && !o.imported)); }
function hourlyDefaults(f) { return Store.settings.hourlyAll && !f.price ? { hourly: true, rate: Store.settings.hourlyRate } : {}; }
function timerBtn(o) {
  if (o.imported || !hourlyOn(o)) return "";
  const ms = timerElapsed(o);
  if (o.timerStart) return `<button class="tmr run" data-act="timer" title="Пауза">${icon("pause")}<span data-timer-id="${o.id}" data-fmt="clock">${fmtDur(ms, true)}</span></button>`;
  if (o.done) return `<span class="tmr static" title="Отработано · ${fmt(o.rate)} ₽/ч">${icon("clock")}${fmtDur(ms)}</span>`;
  if (ms) return `<button class="tmr paused" data-act="timer" title="Продолжить · ${fmt(o.rate)} ₽/ч">${icon("play")}<span>${fmtDur(ms, true).replace(/:\d\d$/, "")}</span></button>`;
  return `<button class="tmr start" data-act="timer" title="Начать отсчёт · ${fmt(o.rate || Store.settings.hourlyRate)} ₽/ч">${icon("play")}<span>Начать</span></button>`;
}
function subBtn(o) {
  if (!feat("subtasks")) return "";
  const n = o.subtasks.length, d = o.subtasks.filter(s => s.done).length, open = OrdersView.expanded.has(o.id);
  if (!n) return `<button class="sub-add ${hourlyOn(o) || open ? "show" : ""} ${open ? "open" : ""}" data-act="subs" data-for="${o.id}" title="Добавить подзадачу">${icon("plus")}</button>`;
  return `<button class="sub-add show has ${d === n ? "all" : ""} ${open ? "open" : ""}" data-act="subs" data-for="${o.id}" title="${open ? "Свернуть" : "Показать"} подзадачи: ${d} из ${n}">${icon("chev-d")}${d}/${n}</button>`;
}

/* ---------- подзадачи: раскрывающийся список прямо под заказом ---------- */
function subListHTML(o) {
  return `<div class="sub-inline">
    ${o.subtasks.map(s => `
      <div class="sub-row ${s.done ? "done" : ""}" data-sid="${s.id}">
        <button class="chk sm ${s.done ? "on" : ""}" data-s="toggle" title="Готово">${icon("check")}</button>
        <input class="field sub-in" data-s="text" value="${esc(s.text)}" draggable="false">
        <button class="mini-ico del" data-s="del" title="Удалить подзадачу">${icon("x")}</button></div>`).join("")}
    <div class="sub-row add"><span class="chk sm ghost">${icon("plus")}</span><input class="field sub-in" data-s="new" placeholder="Новая подзадача — Enter" draggable="false"></div>
  </div>`;
}
/** Перерисовать только список и кнопку-счётчик, не трогая строку (чтобы не терять фокус). */
function refreshSubs(o, focusNew = false) {
  $$(`[data-sub-of="${o.id}"]`).forEach(box => {
    const host = box.matches("tr") ? box.querySelector("td[colspan]") : box;
    host.innerHTML = subListHTML(o);
  });
  $$(`[data-act="subs"][data-for="${o.id}"]`).forEach(b => { b.outerHTML = subBtn(o); });
  if (focusNew) $(`[data-sub-of="${o.id}"] [data-s="new"]`)?.focus();
}
function subOwner(el) { const box = el.closest("[data-sub-of]"); return box ? Store.order(box.dataset.subOf) : null; }
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sub-of] [data-s]");
  if (!b || b.tagName === "INPUT") return;
  const o = subOwner(b), s = o && o.subtasks.find(x => x.id === b.closest("[data-sid]")?.dataset.sid);
  if (!s) return;
  if (b.dataset.s === "toggle") s.done = !s.done;
  if (b.dataset.s === "del") o.subtasks = o.subtasks.filter(x => x !== s);
  Store.commit("orders");
  refreshSubs(o);
});
document.addEventListener("keydown", e => {
  const inp = e.target.closest?.("[data-sub-of] [data-s]");
  if (!inp) return;
  const o = subOwner(inp);
  if (e.key === "Escape") { OrdersView.expanded.delete(o.id); OrdersView.refreshItem(o); return; }
  if (e.key !== "Enter") return;
  e.preventDefault();
  if (inp.dataset.s === "new" && inp.value.trim()) {
    o.subtasks.push({ id: uid(), text: inp.value.trim(), done: false });
    Store.commit("orders");
    refreshSubs(o, true);
  } else inp.blur();
});
document.addEventListener("change", e => {
  const inp = e.target.closest?.('[data-sub-of] [data-s="text"]');
  if (!inp) return;
  const o = subOwner(inp), s = o && o.subtasks.find(x => x.id === inp.closest("[data-sid]").dataset.sid);
  if (!s) return;
  s.text = inp.value.trim();
  if (!s.text) o.subtasks = o.subtasks.filter(x => x !== s);
  Store.commit("orders");
  if (!s.text) refreshSubs(o);
});
function toggleTimer(o, rerender = true) {
  if (o.timerStart) {
    stopTimer(o);
    toast("Таймер остановлен", `${o.client || o.service || "Заказ"}: ${fmtDur(o.timeMs)} · ${money(o.price)}`, "ok", "clock");
  } else {
    const was = o.hourly;
    startTimer(o);
    toast("Таймер запущен", was ? `${o.client || o.service || "Заказ"} · ${fmt(o.rate)} ₽/ч` : `Заказ считается по часам: ${fmt(o.rate)} ₽/ч`, "ok", "play");
  }
  Store.commit("orders");
  if (rerender) { if (currentTab === "orders") OrdersView.refreshItem(o); }
  renderTimerPill();
}
/** Все идущие таймеры: почасовые и секундомеры учёта времени. */
function runningTimers() {
  const out = [];
  for (const o of Store.orders) {
    if (o.timerStart) out.push({ o, kind: "timer", ms: () => timerElapsed(o) });
    if (o.trackStart) out.push({ o, kind: "track", ms: () => trackElapsed(o) });
  }
  return out;
}
function renderTimerPill() {
  const pill = $("#timerPill");
  if (!pill) return;
  const list = runningTimers();
  pill.hidden = !list.length;
  if (!list.length) return;
  const t = list[0], o = t.o;
  pill.classList.toggle("track", t.kind === "track");
  pill.innerHTML = `<span class="tp-dot"></span><b data-timer-id="${o.id}" data-kind="${t.kind}" data-fmt="clock">${fmtDur(t.ms(), true)}</b>
    <span class="tp-name">${esc(o.client || o.service || "Заказ")}${list.length > 1 ? ` +${list.length - 1}` : ""}</span>
    <span class="tp-stop" title="Остановить">${icon("pause")}</span>`;
  pill.onclick = e => {
    if (e.target.closest(".tp-stop")) { t.kind === "timer" ? toggleTimer(o) : toggleTrackUI(o); if (currentTab !== "orders") TABS[currentTab].view.render(); }
    else OrdersView.goTo(o.id);
  };
}
setInterval(() => {
  if (!Store.orders.some(o => o.timerStart || o.trackStart)) return;
  $$("[data-timer-id]").forEach(el => {
    const o = Store.order(el.dataset.timerId);
    if (o) el.textContent = fmtDur(el.dataset.kind === "track" ? trackElapsed(o) : timerElapsed(o), el.dataset.fmt === "clock");
  });
  $$("[data-timer-money]").forEach(el => { const o = Store.order(el.dataset.timerMoney); if (o) el.textContent = money(hourlyPrice(o)); });
}, 1000);

/* ---------- учёт времени (секундомер, цена не меняется) ---------- */
function trackBtn(o) {
  if (!feat("track") || o.hourly || o.imported) return "";
  const ms = trackElapsed(o);
  if (o.trackStart) return `<button class="trk run" data-act="track" title="Остановить учёт времени">${icon("pause")}<span data-timer-id="${o.id}" data-kind="track" data-fmt="clock">${fmtDur(ms, true)}</span></button>`;
  if (ms) return `<button class="trk has" data-act="track" title="Учёт времени: продолжить">${icon("stopwatch")}<span>${fmtDur(ms, true).replace(/:\d\d$/, "")}</span></button>`;
  return o.done ? "" : `<button class="trk" data-act="track" title="Засечь время работы (цена не изменится)">${icon("stopwatch")}</button>`;
}
function toggleTrackUI(o) {
  const was = !!o.trackStart;
  toggleTrack(o);
  toast(was ? "Учёт времени остановлен" : "Время засекается", `${o.client || o.service || "Заказ"}: ${fmtDur(trackElapsed(o))}${was ? "" : " · цена не меняется"}`, "ok", "stopwatch");
  Store.commit("orders");
  if (currentTab === "orders") OrdersView.refreshItem(o);
  renderTimerPill();
}

/* ---------- заметка/ссылка ---------- */
function noteBtn(o) {
  if (!feat("notes") || (!o.note && !o.link)) return "";
  const tip = [o.note, o.link].filter(Boolean).join("\n");
  return `<button class="note-ico" data-act="edit" title="${esc(tip)}">${icon(o.link && !o.note ? "link" : "note")}</button>`;
}

/* ---------- дедлайн: быстрые кнопки и время ---------- */
function deadlineChip(o) {
  if (!o.deadline) return `<span class="date-chip empty" data-act="dl" title="Назначить дедлайн">+ срок</span>`;
  return `<span class="date-chip" data-act="dl" title="Дедлайн: ${longDate(o.deadline)}${o.deadlineTime ? ", до " + o.deadlineTime : ""}">${shortDate(o.deadline)}${o.deadlineTime ? `<small>${o.deadlineTime}</small>` : ""}</span>`;
}
const DeadlinePop = {
  el: null,
  open(anchor, o) {
    this.close();
    const t = todayISO(), fri = addDays(weekStart(t), 4);
    const presets = [["Сегодня", t], ["Завтра", addDays(t, 1)], ["+3 дня", addDays(t, 3)], ["Пятница", fri > t ? fri : addDays(fri, 7)], ["Неделя", addDays(t, 7)], ["2 недели", addDays(t, 14)]];
    const el = this.el = document.createElement("div");
    el.className = "pop dl-pop";
    el.innerHTML = `<div class="pop-head"><b>Дедлайн</b>${o.deadline ? `<span class="muted small">${longDate(o.deadline)}</span>` : ""}</div>
      <div class="dl-presets">${presets.map(([l, d]) => `<button class="btn sm ${o.deadline === d ? "primary" : ""}" data-d="${d}">${l}<small>${shortDate(d)}</small></button>`).join("")}</div>
      <div class="dl-row"><input type="date" class="field" data-k="date" value="${o.deadline || ""}"><input type="time" class="field" data-k="time" value="${o.deadlineTime || ""}" title="Время сдачи (необязательно)"></div>
      <div class="row tight" style="margin-top:10px">${o.deadline ? `<button class="btn sm ghost danger" data-clear>${icon("x")} Убрать срок</button>` : ""}<div class="spacer"></div><button class="btn sm primary" data-ok>Готово</button></div>`;
    document.body.appendChild(el);
    placePop(el, anchor);
    const apply = (d, keep = true) => {
      o.deadline = d || null;
      if (!d) o.deadlineTime = "";
      Store.commit("orders");
      OrdersView.refreshItem(o);
      if (!keep) this.close();
    };
    el.querySelectorAll("[data-d]").forEach(b => b.onclick = () => apply(b.dataset.d, false));
    el.querySelector('[data-k="date"]').onchange = e => apply(e.target.value);
    el.querySelector('[data-k="time"]').onchange = e => { o.deadlineTime = e.target.value || ""; if (!o.deadline && o.deadlineTime) o.deadline = todayISO(); apply(o.deadline); };
    el.querySelector("[data-clear]")?.addEventListener("click", () => apply(null, false));
    el.querySelector("[data-ok]").onclick = () => this.close();
    this.outside = e => { if (!el.contains(e.target)) this.close(); };
    setTimeout(() => document.addEventListener("pointerdown", this.outside, true));
  },
  close() {
    if (!this.el) return;
    document.removeEventListener("pointerdown", this.outside, true);
    this.el.remove(); this.el = null;
  },
};
/** Поставить всплывающее окно рядом с кнопкой; на телефоне — шторкой снизу. */
function placePop(el, anchor) {
  if (isMobile()) { el.classList.add("sheet-pop"); return; }
  const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + "px";
  el.style.top = (r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + "px";
}

/* ---------- быстрый выбор месяца ---------- */
const MonthPicker = {
  el: null,
  open(anchor, current, onPick) {
    if (this.el) return this.close();
    let year = +current.slice(0, 4);
    const counts = new Map();
    Store.orders.forEach(o => counts.set(monthKey(o.date), (counts.get(monthKey(o.date)) || 0) + 1));
    const years = [...new Set(Store.orders.map(o => +o.date.slice(0, 4)))];
    const minY = Math.min(year, ...years), maxY = Math.max(year, new Date().getFullYear(), ...years);
    const el = this.el = document.createElement("div");
    el.className = "pop month-pop";
    const draw = () => {
      el.innerHTML = `<div class="mp-head"><button class="icon-btn sm" data-y="-1" ${year <= minY ? "disabled" : ""}>${icon("chev-l")}</button><b>${year}</b><button class="icon-btn sm" data-y="1" ${year >= maxY ? "disabled" : ""}>${icon("chev-r")}</button></div>
        <div class="mp-grid">${MONTHS_SHORT.map((m, i) => {
          const k = `${year}-${pad(i + 1)}`, n = counts.get(k) || 0;
          return `<button class="mp-m ${k === current ? "on" : ""} ${k === monthKey(todayISO()) ? "now" : ""} ${n ? "" : "empty"}" data-k="${k}">${m}${n ? `<small>${n}</small>` : ""}</button>`;
        }).join("")}</div>`;
      el.querySelectorAll("[data-y]").forEach(b => b.onclick = () => { year += +b.dataset.y; draw(); });
      el.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { this.close(); onPick(b.dataset.k); });
    };
    draw();
    document.body.appendChild(el);
    placePop(el, anchor);
    this.outside = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) this.close(); };
    setTimeout(() => document.addEventListener("pointerdown", this.outside, true));
  },
  close() {
    if (!this.el) return;
    document.removeEventListener("pointerdown", this.outside, true);
    this.el.remove(); this.el = null;
  },
};

/* ---------- вид «Календарь» ---------- */
Object.assign(OrdersView, {
  calDay: null,
  renderCalendar() {
    const key = this.month, start = monthStart(key), end = monthEnd(key), t = todayISO();
    const q = this.search, f = this.filter === "undone" ? (o => !o.done) : this.filter === "unpaid" ? (o => debtOf(o) > 0) : () => true;
    const match = o => f(o) && (!q || (o.client + " " + o.service).toLowerCase().includes(q));
    const byDay = new Map(), dls = new Map();
    let undated = 0;
    for (const o of Store.orders) {
      if (!match(o)) continue;
      if (o.date >= start && o.date <= end) { if (o.dateUnknown) undated++; else (byDay.get(o.date) || byDay.set(o.date, []).get(o.date)).push(o); }
      if (o.deadline && o.deadline >= start && o.deadline <= end && !o.done) (dls.get(o.deadline) || dls.set(o.deadline, []).get(o.deadline)).push(o);
    }
    const mob = isMobile(), first = weekStart(start);
    let cells = "";
    const total = Math.ceil((daysBetween(first, end) + 1) / 7) * 7;
    for (let i = 0; i < total; i++) {
      const d = addDays(first, i);
      const inM = d >= start && d <= end, items = byDay.get(d) || [], due = dls.get(d) || [];
      const chips = mob ? `<div class="cal-dots">${items.slice(0, 4).map(o => `<i style="background:${serviceColor(o.service) || "var(--text-2)"}"></i>`).join("")}${due.length ? `<i class="dl ${d < t ? "late" : ""}"></i>` : ""}</div>`
        : [...due.slice(0, 2).map(o => `<div class="cal-chip dl ${d < t ? "late" : ""}" data-open="${o.id}">${icon("clock")}${esc(o.client || o.service || "заказ")}</div>`),
           ...items.slice(0, due.length ? 2 : 3).map(o => `<div class="cal-chip ${o.paid ? "paid" : ""}" data-open="${o.id}" style="--svc:${serviceColor(o.service) || "var(--muted-2)"}">${esc(o.client || "—")} · ${esc(o.service || "—")}</div>`)].join("")
          + (items.length + due.length > (due.length ? 4 : 3) ? `<div class="cal-more">ещё ${items.length + due.length - (due.length ? Math.min(2, due.length) + Math.min(2, items.length) : Math.min(3, items.length))}</div>` : "");
      cells += `<div class="cal-d ${inM ? "" : "out"} ${d === t ? "today" : ""} ${this.calDay === d ? "picked" : ""}" data-cd="${d}">
        <div class="cal-n">${parseISO(d).getDate()}</div>${inM ? chips : ""}</div>`;
    }
    const pick = this.calDay && this.calDay >= start && this.calDay <= end ? this.calDay : null;
    const dayList = pick ? Store.orders.filter(o => match(o) && ((o.date === pick && !o.dateUnknown) || o.deadline === pick)) : [];
    $("#oCal").innerHTML = `
      <div class="card cal-card">
        <div class="cal-grid cal-head">${WEEKDAYS.map(w => `<div>${w}</div>`).join("")}</div>
        <div class="cal-grid">${cells}</div>
        ${undated ? `<div class="cal-note">${icon("cal")} Без даты в этом месяце: ${undated} — <button class="link-btn" data-undated>показать</button></div>` : ""}
      </div>
      ${pick ? `<div class="cal-day-list"><h3 class="cal-day-title">${longDate(pick)}<span class="muted"> · ${dayList.length} ${plural(dayList.length, "заказ", "заказа", "заказов")}</span>
          <button class="btn sm primary" data-new="${pick}">${icon("plus")} Заказ на этот день</button></h3>
        <div class="bcol-list">${dayList.map(o => this.cardHTML(o)).join("") || `<div class="bcol-empty">Пусто</div>`}</div></div>` : `<div class="muted small cal-hint">Нажмите на день, чтобы увидеть его заказы и добавить новый</div>`}`;
  },
  bindCalendar() {
    const box = $("#oCal");
    box.addEventListener("click", e => {
      const open = e.target.closest("[data-open]");
      if (open) { e.stopPropagation(); return OrderSheet.open(open.dataset.open); }
      const nw = e.target.closest("[data-new]");
      if (nw) return this.add({ date: nw.dataset.new });
      if (e.target.closest("[data-undated]")) { this.day = null; Store.settings.ordersView = "table"; if (isMobile()) { Store.local.mobileView = "board"; } this.filter = "all"; return this.renderList(); }
      const card = e.target.closest(".kcard");
      if (card) {
        if (e.target.closest(".kc-subs, a")) return;
        const o = Store.order(card.dataset.id), btn = e.target.closest("[data-act]");
        return btn ? this.act(o, btn.dataset.act, btn) : OrderSheet.open(o.id);
      }
      const d = e.target.closest("[data-cd]");
      if (d && !d.classList.contains("out")) { this.calDay = this.calDay === d.dataset.cd ? null : d.dataset.cd; this.renderCalendar(); }
    });
  },
});

function upcomingDeadlines(days) {
  const t = todayISO(), lim = addDays(t, days);
  return Store.orders.filter(o => o.deadline && !o.done && o.deadline <= lim).sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/* ---------- карточка заказа: все поля, история оплат ---------- */
const OrderSheet = {
  id: null,
  open(id) {
    this.id = id;
    onModalClose = () => { this.id = null; if (currentTab === "orders") OrdersView.renderList(); else TABS[currentTab].view.render(); };
    this.render();
  },
  get o() { return Store.order(this.id); },
  render() {
    const o = this.o;
    if (!o) return closeModal();
    const m = openModal(`
      <div class="sheet-head"><h3>${esc(o.client || "Новый заказ")}</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
      <div class="sheet-grid">
        <label>Клиент<input class="field" data-f="client" data-ac="client" value="${esc(o.client)}" autocomplete="off"></label>
        <label>Услуга<input class="field" data-f="service" data-ac="service" value="${esc(o.service)}" autocomplete="off"></label>
        <label>Прайс, ₽${o.hourly ? ` <small class="muted">считается по времени</small>` : ""}<input class="field" data-f="price" inputmode="numeric" value="${o.price ? fmt(o.price) : ""}" ${o.hourly ? "readonly" : ""}></label>
        <label>Дата заказа
          <div class="row tight"><input class="field" type="date" data-f="date" value="${o.dateUnknown ? "" : o.date}">
          ${o.dateUnknown ? `<span class="tag">не указано</span>` : ""}</div></label>
        <label>Дедлайн
          <div class="row tight"><input class="field" type="date" data-f="deadline" value="${o.deadline || ""}"><input class="field time-in" type="time" data-f="deadlineTime" value="${o.deadlineTime || ""}" title="Время сдачи"></div></label>
        <div class="sheet-toggles">
          <button class="pill-toggle ${o.done ? "on" : ""}" data-t="done">${icon("check")} Выполнен</button>
          <button class="pill-toggle ${o.remind ? "on" : ""}" data-t="remind">${icon("bell")} Напоминать</button>
        </div>
      </div>
      ${feat("notes") ? `<div class="sec-head"><b>${icon("note")}Заметка и ссылка</b></div>
      <textarea class="field note-in" data-f="note" rows="2" placeholder="ТЗ, пожелания клиента, детали">${esc(o.note)}</textarea>
      <div class="row tight" style="margin-top:8px"><input class="field" data-f="link" value="${esc(o.link)}" placeholder="Ссылка: переписка, ТЗ, файлы" autocomplete="off">${o.link ? `<a class="btn sm" href="${esc(/^[a-z]+:/i.test(o.link) ? o.link : "https://" + o.link)}" target="_blank" rel="noopener">${icon("link")} Открыть</a>` : ""}</div>` : ""}
      ${feat("track") && !o.hourly ? `<div class="sec-head"><b>${icon("stopwatch")}Учёт времени</b><span class="muted small">цена не меняется</span></div>
      <div class="hourly-box"><div class="hb-timer">
        <div><div class="hb-time" data-timer-id="${o.id}" data-kind="track" data-fmt="clock">${fmtDur(trackElapsed(o), true)}</div>
          <div class="muted small">${trackElapsed(o) >= 60000 && o.price ? `реальная ставка ≈ <b>${money(o.price / (trackElapsed(o) / 3600000))}/ч</b>` : "засеките время, чтобы увидеть реальную ставку"}</div></div>
        <button class="btn ${o.trackStart ? "" : "primary"}" data-tk="toggle">${icon(o.trackStart ? "pause" : "stopwatch")} ${o.trackStart ? "Пауза" : trackElapsed(o) ? "Продолжить" : "Засечь"}</button></div>
        <div class="row tight" style="margin-top:10px"><input class="field" data-tk="hours" type="number" min="0" value="${Math.floor(trackElapsed(o) / 3600000)}"><span class="muted">ч</span>
          <input class="field" data-tk="mins" type="number" min="0" max="59" value="${Math.floor(trackElapsed(o) % 3600000 / 60000)}"><span class="muted">мин</span>
          <button class="btn sm" data-tk="save">${icon("check")} Записать</button></div></div>` : ""}
      ${feat("hourly") || o.hourly ? `<div class="sec-head"><b>${icon("clock")}Почасовая оплата</b><button class="toggle ${o.hourly ? "on" : ""}" data-hourly></button></div>
      ${o.hourly ? `<div class="hourly-box">
        <div class="hb-timer">
          <div><div class="hb-time" data-timer-id="${o.id}" data-fmt="clock">${fmtDur(timerElapsed(o), true)}</div>
            <div class="muted small">к оплате: ${fmtDur(billedMinutes(timerElapsed(o)) * 60000)} × ${money(o.rate)} = <b data-timer-money="${o.id}">${money(hourlyPrice(o))}</b></div></div>
          <button class="btn ${o.timerStart ? "" : "primary"}" data-tmr>${icon(o.timerStart ? "pause" : "play")} ${o.timerStart ? "Пауза" : timerElapsed(o) ? "Продолжить" : "Начать"}</button>
        </div>
        <div class="hb-grid">
          <label>Ставка, ₽/ч<input class="field" data-h="rate" inputmode="numeric" value="${fmt(o.rate)}"></label>
          <label>Время вручную
            <div class="row tight"><input class="field" data-h="hours" type="number" min="0" value="${Math.floor(timerElapsed(o) / 3600000)}"><span class="muted">ч</span>
            <input class="field" data-h="mins" type="number" min="0" max="59" value="${Math.floor(timerElapsed(o) % 3600000 / 60000)}"><span class="muted">мин</span></div></label>
        </div>
        <div class="row tight" style="margin-top:8px"><button class="btn sm" data-h="save">${icon("check")} Записать время</button><button class="btn sm ghost" data-h="reset">Сбросить</button></div>
      </div>` : `<div class="muted small sec-hint">Включите, чтобы прайс считался по времени: таймер или часы вручную. Ставка по умолчанию — ${money(Store.settings.hourlyRate)}/ч (меняется в настройках).</div>`}` : ""}
      ${feat("subtasks") ? `<div class="sec-head"><b>${icon("list")}Подзадачи</b><span class="muted small">${o.subtasks.length ? `${o.subtasks.filter(s => s.done).length} из ${o.subtasks.length}` : ""}</span></div>
      <div class="sub-list">${o.subtasks.map(s => `
        <div class="sub-row ${s.done ? "done" : ""}" data-sid="${s.id}">
          <button class="chk sm ${s.done ? "on" : ""}" data-s="toggle">${icon("check")}</button>
          <input class="field sub-in" data-s="text" value="${esc(s.text)}" placeholder="Что сделать">
          <button class="mini-ico del" data-s="del" title="Удалить">${icon("x")}</button>
        </div>`).join("")}
        <div class="sub-row add"><span class="chk sm ghost">${icon("plus")}</span><input class="field sub-in" data-s="new" placeholder="Добавить подзадачу и нажать Enter"></div>
      </div>` : ""}
      <div class="pay-head"><b>Оплаты</b><span class="muted">получено ${money(o.received)} из ${money(o.price)}${debtOf(o) ? ` · долг <b class="red">${money(debtOf(o))}</b>` : ""}</span></div>
      <div class="pay-list">${o.payments.map(p => `
        <div class="pay-row" data-pid="${p.id}">
          <input class="field" type="date" data-p="date" value="${p.date || ""}" ${p.imported ? 'title="Архив из Excel — дата не известна"' : ""}>
          <input class="field" data-p="amount" inputmode="numeric" value="${fmt(p.amount)}">
          ${p.imported ? `<span class="tag">архив</span>` : ""}
          <button class="mini-ico del" data-pdel title="Удалить платёж">${icon("trash")}</button>
        </div>`).join("") || `<div class="muted" style="padding:6px 2px">Оплат пока не было</div>`}</div>
      <div class="row wrap" style="margin-top:10px">
        <button class="btn sm" data-addpay>${icon("plus")} Платёж</button>
        ${debtOf(o) > 0 ? `<button class="btn sm primary" data-payall>${icon("coin")} Оплачено полностью</button>` : ""}
      </div>
      <div class="m-actions sheet-actions">
        <button class="btn sm ghost" data-a="repeat">${icon("copy")} Повторить</button>
        <button class="btn sm ghost" data-a="ics">${icon("cal")} В календарь</button>
        <button class="btn sm ghost danger" data-a="del">${icon("trash")} Удалить</button>
        <div class="spacer"></div>
        <button class="btn primary" data-x>Готово</button>
      </div>`, "sheet");
    this.bind(m);
  },
  bind(m) {
    const o = this.o;
    const commit = (rerender = false) => { Store.commit("orders"); if (rerender) this.render(); };
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = closeModal);
    m.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener("change", () => {
      const f = inp.dataset.f, v = inp.value.trim();
      if (f === "client" || f === "service") {
        o[f] = v;
        if (!o.price && !o.hourly) { const p = suggestPrice(o.client, o.service); if (p) { setPrice(o, p); return commit(true); } }
        if (f === "client") m.querySelector("h3").textContent = v || "Новый заказ";
      }
      if (f === "price") { setPrice(o, parseMoney(v)); return commit(true); }
      if (f === "date") { if (v) { o.date = v; o.dateUnknown = false; } return commit(true); }
      if (f === "deadline") { o.deadline = v || null; if (!v) o.deadlineTime = ""; }
      if (f === "deadlineTime") { o.deadlineTime = v; if (v && !o.deadline) { o.deadline = todayISO(); return commit(true); } }
      if (f === "note") o.note = inp.value;
      if (f === "link") { o.link = v; return commit(true); }
      commit();
    }));
    m.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
      const t = b.dataset.t;
      if (t === "done") { o.done = !o.done; o.doneDate = o.done ? todayISO() : null; if (o.done && o.timerStart) { stopTimer(o); renderTimerPill(); return commit(true); } }
      if (t === "remind") o.remind = !o.remind;
      b.classList.toggle("on", o[t]);
      commit();
    });
    m.querySelectorAll(".pay-row").forEach(row => {
      const p = o.payments.find(x => x.id === row.dataset.pid);
      row.querySelector('[data-p="date"]').onchange = e => { p.date = e.target.value || null; if (p.date) delete p.imported; recalcOrder(o); commit(); };
      row.querySelector('[data-p="amount"]').onchange = e => { p.amount = parseMoney(e.target.value); o.payments = o.payments.filter(x => x.amount > 0); recalcOrder(o); commit(true); };
      row.querySelector("[data-pdel]").onclick = () => { o.payments = o.payments.filter(x => x !== p); recalcOrder(o); commit(true); };
    });
    m.querySelector("[data-addpay]").onclick = () => {
      o.payments.push({ id: uid(), date: todayISO(), amount: Math.max(debtOf(o), 0) || 1000 });
      recalcOrder(o); commit(true);
      $$(".pay-row [data-p=amount]", m).pop()?.select();
    };
    m.querySelector("[data-payall]")?.addEventListener("click", () => { setPaid(o, true); commit(true); });

    // учёт времени
    m.querySelector('[data-tk="toggle"]')?.addEventListener("click", () => { toggleTrack(o); renderTimerPill(); commit(true); });
    m.querySelector('[data-tk="save"]')?.addEventListener("click", () => {
      const v = k => Math.max(0, parseInt(m.querySelector(`[data-tk="${k}"]`).value) || 0);
      o.trackMs = (v("hours") * 60 + v("mins")) * 60000;
      if (o.trackStart) o.trackStart = Date.now();
      commit(true);
      toast("Время записано", fmtDur(o.trackMs), "ok", "stopwatch");
    });
    // почасовая оплата
    m.querySelector("[data-hourly]")?.addEventListener("click", () => {
      if (o.hourly) { if (o.timerStart) stopTimer(o); o.hourly = false; }
      else { o.hourly = true; o.rate = o.rate || Store.settings.hourlyRate; setPrice(o, hourlyPrice(o)); }
      commit(true);
    });
    m.querySelector("[data-tmr]")?.addEventListener("click", () => { toggleTimer(o, false); this.render(); });
    m.querySelector('[data-h="rate"]')?.addEventListener("change", e => { o.rate = parseMoney(e.target.value); setPrice(o, hourlyPrice(o)); commit(true); });
    const hv = k => Math.max(0, parseInt(m.querySelector(`[data-h="${k}"]`).value) || 0);
    m.querySelector('[data-h="save"]')?.addEventListener("click", () => { setWorkTime(o, (hv("hours") * 60 + hv("mins")) * 60000); commit(true); toast("Время записано", `${fmtDur(o.timeMs)} · ${money(o.price)}`, "ok", "clock"); });
    m.querySelector('[data-h="reset"]')?.addEventListener("click", async () => {
      if (await confirmBox("Сбросить время?", "Таймер остановится, время станет 0.", "Сбросить", true)) { o.timerStart = null; setWorkTime(o, 0); Store.commit("orders"); }
      this.render();
    });

    // подзадачи
    m.querySelectorAll(".sub-row[data-sid]").forEach(row => {
      const s = o.subtasks.find(x => x.id === row.dataset.sid);
      row.querySelector('[data-s="toggle"]').onclick = () => { s.done = !s.done; commit(true); };
      row.querySelector('[data-s="text"]').onchange = e => { s.text = e.target.value.trim(); if (!s.text) o.subtasks = o.subtasks.filter(x => x !== s); commit(!s.text); };
      row.querySelector('[data-s="del"]').onclick = () => { o.subtasks = o.subtasks.filter(x => x !== s); commit(true); };
    });
    const ni = m.querySelector('[data-s="new"]');
    if (ni) {
    ni.onkeydown = e => {
      if (e.key !== "Enter" || !ni.value.trim()) return;
      e.preventDefault();
      const text = ni.value.trim();
      ni.value = "";
      o.subtasks.push({ id: uid(), text, done: false });
      commit(true);
      $('#modalBody [data-s="new"]')?.focus();
    };
    ni.onblur = () => { if (ni.value.trim()) { o.subtasks.push({ id: uid(), text: ni.value.trim(), done: false }); ni.value = ""; commit(true); } };
    }
    m.querySelector('[data-a="repeat"]').onclick = () => { closeModal(); OrdersView.repeat(o); };
    m.querySelector('[data-a="ics"]').onclick = () => {
      if (!o.deadline) return toast("Нет дедлайна", "Сначала укажите срок сдачи", "warn", "cal");
      exportICS([o], `comlog-${(o.client || "zakaz").replace(/[^\wа-яё-]+/gi, "_")}.ics`);
    };
    m.querySelector('[data-a="del"]').onclick = () => { onModalClose = null; closeModal(); OrdersView.remove(o); };
  },
};
