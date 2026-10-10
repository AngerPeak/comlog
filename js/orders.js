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

  mount() {
    const el = $("#page-orders");
    el.innerHTML = `
      <div class="row wrap">
        <div class="month-nav">
          <button class="icon-btn" data-m="-1" title="Предыдущий месяц">${icon("chev-l")}</button>
          <div class="mn-title" id="mnTitle"></div>
          <button class="icon-btn" data-m="1" title="Следующий месяц">${icon("chev-r")}</button>
          <button class="btn sm ghost" id="mnToday">Сегодня</button>
        </div>
        <div class="spacer"></div>
        <div class="seg desk-only" id="oView"><button data-v="table">${icon("table")}Таблица</button><button data-v="board">${icon("board")}Доска</button></div>
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
          <colgroup><col class="c-date"><col class="c-client"><col class="c-service"><col class="c-money"><col class="c-money"><col class="c-chk"><col class="c-chk"><col class="c-dl"><col class="c-act"></colgroup>
          <thead><tr>
            <th class="col-date">Дата</th><th class="col-client">Клиент</th><th class="col-service">Услуга</th><th class="col-price r">Прайс</th><th class="col-received r">Получено</th>
            <th class="col-done c-chk">Выполнен</th><th class="col-paid c-chk">Оплачен</th><th class="col-deadline">Дедлайн</th><th></th>
          </tr></thead>
          <tbody id="oBody"></tbody>
        </table>
        <div id="oEmpty"></div>
        <div class="table-foot" id="oFoot"></div>
      </div>
      <div id="oBoard" hidden></div>`;

    el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { this.month = shiftMonth(this.month, +b.dataset.m); this.render(); });
    $("#mnToday").onclick = () => { this.month = monthKey(todayISO()); this.render(); };
    $("#addOrder").onclick = () => this.add();
    $("#addMore").onclick = e => this.moreMenu(e.currentTarget);
    $("#oSearch").oninput = e => { this.search = e.target.value.trim().toLowerCase(); this.renderList(); };
    $$("#oFilter button").forEach(b => b.onclick = () => { this.filter = b.dataset.f; this.renderList(); });
    $$("#oView button").forEach(b => b.onclick = () => { Store.settings.ordersView = b.dataset.v; Store.commit("settings"); this.renderList(); });
    this.bindTable();
    this.bindBoard();
    window.matchMedia("(max-width: 760px)").addEventListener("change", () => currentTab === "orders" && this.renderList());
  },

  get view() { return isMobile() ? "board" : Store.settings.ordersView; },

  render() {
    $("#mnTitle").textContent = monthTitle(this.month);
    this.renderList();
  },

  /** Что показывать: месяц; при фильтре — ещё и хвосты прошлых месяцев; при поиске — все месяцы. */
  visible() {
    const q = this.search, start = monthStart(this.month), end = monthEnd(this.month);
    const f = this.filter === "undone" ? (o => !o.done) : this.filter === "unpaid" ? (o => debtOf(o) > 0 || (!o.paid && !o.price)) : null;
    let list;
    if (q) list = Store.orders.filter(o => (o.client + " " + o.service).toLowerCase().includes(q));
    else if (f) list = Store.orders.filter(o => o.date <= end);
    else list = Store.orders.filter(o => o.date >= start && o.date <= end);
    if (f) list = list.filter(f);
    return list.sort((a, b) => monthKey(b.date).localeCompare(monthKey(a.date)) || (a.dateUnknown - b.dateUnknown) || b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },
  get crossMonth() { return !!this.search || this.filter !== "all"; },

  renderList() {
    $$("#oFilter button").forEach(x => x.classList.toggle("on", x.dataset.f === this.filter));
    $$("#oView button").forEach(x => x.classList.toggle("on", x.dataset.v === Store.settings.ordersView));
    const list = this.visible();
    const board = this.view === "board";
    $("#oTableCard").hidden = board;
    $("#oBoard").hidden = !board;
    const other = this.crossMonth ? list.filter(o => monthKey(o.date) !== this.month).length : 0;
    $("#oScope").innerHTML = this.search
      ? `<div class="scope-note">${icon("search")} Поиск по всем месяцам: найдено ${list.length}</div>`
      : other ? `<div class="scope-note">${icon("clock")} Учтены хвосты прошлых месяцев: ${other} ${plural(other, "заказ", "заказа", "заказов")}</div>` : "";
    if (board) this.renderBoard(list); else this.renderTable(list);
    this.renderSummary(list);
  },

  /* ---------- таблица ---------- */
  renderTable(list) {
    const card = $("#oTableCard");
    card.classList.toggle("colored", !!Store.settings.colorColumns);
    let html = "", lastMonth = null;
    const groups = this.crossMonth;
    for (const o of list) {
      const mk = monthKey(o.date);
      if (groups && mk !== lastMonth) {
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
      <h4>${nothing ? "В этом месяце пока нет заказов" : this.filter !== "all" && !this.search ? "Хвостов нет — всё закрыто 👌" : "Ничего не найдено"}</h4>
      <div>${nothing ? "Нажмите «Новый заказ» или Ctrl+N" : "Попробуйте изменить фильтр или поиск"}</div></div>`;
  },

  rowHTML(o) {
    const color = serviceColor(o.service);
    const dateTitle = o.dateUnknown ? "Дата не указана — нажмите, чтобы выбрать" : longDate(o.date);
    const multi = o.payments.length > 1;
    return `<tr data-id="${o.id}" class="${o.done ? "is-done" : ""} ${o.paid ? "is-paid" : ""} ${monthKey(o.date) !== this.month ? "is-other" : ""}">
      <td class="col-date"><span class="date-chip ${o.dateUnknown ? "unknown" : ""}" data-act="pick" title="${dateTitle}">${orderDateLabel(o, this.crossMonth)}<input type="date" class="hidden-date" data-f="date" value="${o.date}" tabindex="-1"></span></td>
      <td class="col-client"><input class="cell-in t-client" data-f="client" data-ac="client" value="${esc(o.client)}" placeholder="Имя клиента" spellcheck="false" autocomplete="off"></td>
      <td class="col-service"><div class="svc ${color ? "has" : ""}" style="${color ? `--svc:${color}` : ""}"><input class="cell-in t-service" data-f="service" data-ac="service" value="${esc(o.service)}" placeholder="Наименование услуги" spellcheck="false" autocomplete="off">${timerBtn(o)}${subBtn(o)}</div></td>
      <td class="col-price"><input class="cell-in money ${o.hourly ? "auto" : ""}" data-f="price" value="${o.price ? fmt(o.price) : ""}" placeholder="0" inputmode="numeric" ${o.hourly ? `readonly title="Почасовая: ${fmt(o.rate)} ₽/ч × ${fmtDur(timerElapsed(o))}. Ставка и время — в карточке заказа (⋯)"` : ""}></td>
      <td class="col-received"><div class="got">${multi ? `<button class="pay-count" data-act="edit" title="Платежей: ${o.payments.length}">${o.payments.length}</button>` : ""}<input class="cell-in money money-got" data-f="received" value="${o.received ? fmt(o.received) : ""}" placeholder="0" inputmode="numeric"></div></td>
      <td class="col-done c-chk"><button class="chk done ${o.done ? "on" : ""}" data-act="done" title="Заказ выполнен">${icon("check")}</button></td>
      <td class="col-paid c-chk"><button class="chk pay ${o.paid ? "on" : ""}" data-act="paid" title="Оплачен — остаток добавится платежом">${icon("check")}</button></td>
      <td class="col-deadline"><div class="dl">
        <span class="date-chip ${o.deadline ? "" : "empty"}" data-act="pick" title="${o.deadline ? "Дедлайн: " + longDate(o.deadline) : "Назначить дедлайн"}">${o.deadline ? shortDate(o.deadline) : "+ срок"}<input type="date" class="hidden-date" data-f="deadline" value="${o.deadline || ""}" tabindex="-1"></span>
        ${deadlineBadge(o)}</div></td>
      <td><div class="acts">
        <button class="mini-ico" data-act="repeat" title="Повторить заказ">${icon("copy")}</button>
        <button class="mini-ico ${o.remind ? "bell-on" : ""}" data-act="remind" title="${o.remind ? "Напоминание включено" : "Напоминание выключено"}">${icon("bell")}</button>
        <button class="mini-ico" data-act="edit" title="Подробнее: оплаты, дата">${icon("dots")}</button>
        <button class="mini-ico del" data-act="del" title="Удалить заказ">${icon("trash")}</button>
      </div></td></tr>${this.expanded.has(o.id) ? `<tr class="sub-tr" data-sub-of="${o.id}"><td></td><td colspan="8">${subListHTML(o)}</td></tr>` : ""}`;
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
    body.addEventListener("keydown", e => {
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
    $$("#oBoard [data-bt]").forEach(b => b.onclick = () => { this.boardTab = b.dataset.bt; this.renderList(); });
  },
  cardHTML(o) {
    const color = serviceColor(o.service);
    return `<div class="kcard" draggable="true" data-id="${o.id}" style="${color ? `--svc:${color}` : ""}">
      <div class="kc-top"><span class="date-chip ${o.dateUnknown ? "unknown" : ""}">${orderDateLabel(o, this.crossMonth)}</span>
        ${o.deadline ? `<span class="date-chip" title="Дедлайн">${icon("clock")}${shortDate(o.deadline)}</span>${deadlineBadge(o)}` : ""}</div>
      <div class="kc-client">${esc(o.client || "Без имени")}</div>
      <div class="kc-service">${color ? `<i class="dot" style="background:${color}"></i>` : ""}${esc(o.service || "Услуга не указана")}</div>
      <div class="kc-foot">
        <span class="kc-money"><b>${money(o.price)}</b>${o.received && o.received < o.price ? `<small>получено ${money(o.received)}</small>` : ""}</span>
        ${timerBtn(o)}${subBtn(o)}
        <button class="mini-ico" data-act="repeat" title="Повторить">${icon("copy")}</button>
        <button class="chk done ${o.done ? "on" : ""}" data-act="done" title="Выполнен">${icon("check")}</button>
        <button class="chk pay ${o.paid ? "on" : ""}" data-act="paid" title="Оплачен"><b class="rub">₽</b></button>
      </div>${this.expanded.has(o.id) ? `<div class="kc-subs" data-sub-of="${o.id}">${subListHTML(o)}</div>` : ""}</div>`;
  },
  bindBoard() {
    const b = $("#oBoard");
    b.addEventListener("click", e => {
      const card = e.target.closest(".kcard");
      if (!card || e.target.closest(".kc-subs")) return;   // подзадачи обрабатываются отдельно
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
  addMany(base, n) {
    const created = [];
    for (let i = 0; i < n; i++) { const o = normalizeOrder({ ...hourlyDefaults(base), ...base, createdAt: Date.now() + i }); Store.orders.push(o); created.push(o); }
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
        <div class="tp-main"><b>${esc(t.service)}</b><small>${t.client ? esc(t.client) + " · " : ""}${money(t.price)}</small></div>
        <input class="field num-in" type="number" min="1" max="99" value="1">
        <button class="btn sm primary" data-add>${icon("plus")}</button></div>`).join("")}</div>
      <div class="m-actions"><button class="btn" data-r="0">Готово</button></div>`, "wide");
    m.querySelector('[data-r="0"]').onclick = closeModal;
    m.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
      const row = b.closest(".tpl-row"), t = tpls.find(x => x.id === row.dataset.id);
      const n = Math.max(1, Math.min(99, parseInt(row.querySelector("input").value) || 1));
      this.addMany({ client: t.client, service: t.service, price: t.price, date: this.newDate() }, n);
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
        <div class="k-foot">на руки ${money(st.received - st.tax)}</div></div>` : ""}`;

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
      html += `<div class="day ${d === t ? "today" : ""}" title="${esc(tip || longDate(d))}"><div class="dots">${dots}</div>
        <div class="d-w">${WEEKDAYS[i]}</div><div class="d-n">${parseISO(d).getDate()}</div></div>`;
    }
    $("#weekStrip").innerHTML = html;
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
function hourlyOn(o) { return o.hourly || (Store.settings.hourlyAll && !o.done && !o.imported); }
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
function runningTimers() { return Store.orders.filter(o => o.timerStart); }
function renderTimerPill() {
  const pill = $("#timerPill");
  if (!pill) return;
  const list = runningTimers();
  pill.hidden = !list.length;
  if (!list.length) return;
  const o = list[0];
  pill.innerHTML = `<span class="tp-dot"></span><b data-timer-id="${o.id}" data-fmt="clock">${fmtDur(timerElapsed(o), true)}</b>
    <span class="tp-name">${esc(o.client || o.service || "Заказ")}${list.length > 1 ? ` +${list.length - 1}` : ""}</span>
    <span class="tp-stop" title="Остановить">${icon("pause")}</span>`;
  pill.onclick = e => {
    if (e.target.closest(".tp-stop")) { toggleTimer(o); if (currentTab !== "orders") TABS[currentTab].view.render(); }
    else OrdersView.goTo(o.id);
  };
}
setInterval(() => {
  if (!Store.orders.some(o => o.timerStart)) return;
  $$("[data-timer-id]").forEach(el => {
    const o = Store.order(el.dataset.timerId);
    if (o) el.textContent = fmtDur(timerElapsed(o), el.dataset.fmt === "clock");
  });
  $$("[data-timer-money]").forEach(el => { const o = Store.order(el.dataset.timerMoney); if (o) el.textContent = money(hourlyPrice(o)); });
}, 1000);

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
        <label>Дедлайн<input class="field" type="date" data-f="deadline" value="${o.deadline || ""}"></label>
        <div class="sheet-toggles">
          <button class="pill-toggle ${o.done ? "on" : ""}" data-t="done">${icon("check")} Выполнен</button>
          <button class="pill-toggle ${o.remind ? "on" : ""}" data-t="remind">${icon("bell")} Напоминать</button>
        </div>
      </div>
      <div class="sec-head"><b>${icon("clock")}Почасовая оплата</b><button class="toggle ${o.hourly ? "on" : ""}" data-hourly></button></div>
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
      </div>` : `<div class="muted small sec-hint">Включите, чтобы прайс считался по времени: таймер или часы вручную. Ставка по умолчанию — ${money(Store.settings.hourlyRate)}/ч (меняется в настройках).</div>`}
      <div class="sec-head"><b>${icon("list")}Подзадачи</b><span class="muted small">${o.subtasks.length ? `${o.subtasks.filter(s => s.done).length} из ${o.subtasks.length}` : ""}</span></div>
      <div class="sub-list">${o.subtasks.map(s => `
        <div class="sub-row ${s.done ? "done" : ""}" data-sid="${s.id}">
          <button class="chk sm ${s.done ? "on" : ""}" data-s="toggle">${icon("check")}</button>
          <input class="field sub-in" data-s="text" value="${esc(s.text)}" placeholder="Что сделать">
          <button class="mini-ico del" data-s="del" title="Удалить">${icon("x")}</button>
        </div>`).join("")}
        <div class="sub-row add"><span class="chk sm ghost">${icon("plus")}</span><input class="field sub-in" data-s="new" placeholder="Добавить подзадачу и нажать Enter"></div>
      </div>
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
      if (f === "deadline") o.deadline = v || null;
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

    // почасовая оплата
    m.querySelector("[data-hourly]").onclick = () => {
      if (o.hourly) { if (o.timerStart) stopTimer(o); o.hourly = false; }
      else { o.hourly = true; o.rate = o.rate || Store.settings.hourlyRate; setPrice(o, hourlyPrice(o)); }
      commit(true);
    };
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
    m.querySelector('[data-a="repeat"]').onclick = () => { closeModal(); OrdersView.repeat(o); };
    m.querySelector('[data-a="ics"]').onclick = () => {
      if (!o.deadline) return toast("Нет дедлайна", "Сначала укажите срок сдачи", "warn", "cal");
      exportICS([o], `comlog-${(o.client || "zakaz").replace(/[^\wа-яё-]+/gi, "_")}.ics`);
    };
    m.querySelector('[data-a="del"]').onclick = () => { onModalClose = null; closeModal(); OrdersView.remove(o); };
  },
};
