/* Вкладка «Сметы»: список работ клиента за период — услуга, количество, сумма и итог.
   Готовый текст копируется одной кнопкой, чтобы отправить клиенту. */
const EstimatesView = {
  client: "",
  month: null,
  preset: "",          // h1 — 1–15, h2 — 16–конец, m — весь месяц, custom
  from: "", to: "",
  onlyUnpaid: false,

  /** По умолчанию: до 15-го числа — вторая половина прошлого месяца, после — первая половина текущего. */
  defaults() {
    const t = todayISO(), d = +t.slice(8);
    const ui = Store.local.ui?.est || {};
    this.client = this.client || ui.client || clientNames().sort((a, b) => this.count(b) - this.count(a))[0] || "";
    this.onlyUnpaid = ui.onlyUnpaid ?? this.onlyUnpaid;
    if (!this.preset) { this.preset = d <= 15 ? "h2" : "h1"; this.month = d <= 15 ? shiftMonth(monthKey(t), -1) : monthKey(t); }
  },
  count(name) { return Store.orders.filter(o => o.client.trim() === name).length; },
  remember() { Store.local.ui = { ...(Store.local.ui || {}), est: { client: this.client, onlyUnpaid: this.onlyUnpaid } }; Store.saveLocal(); },

  range() {
    const k = this.month;
    if (this.preset === "h1") return { from: `${k}-01`, to: `${k}-15` };
    if (this.preset === "h2") return { from: `${k}-16`, to: monthEnd(k) };
    if (this.preset === "m") return { from: monthStart(k), to: monthEnd(k) };
    const from = this.from || monthStart(k), to = this.to || monthEnd(k);
    return from <= to ? { from, to } : { from: to, to: from };
  },
  rangeLabel(r) {
    const a = parseISO(r.from), b = parseISO(r.to);
    if (r.from.slice(0, 7) === r.to.slice(0, 7)) return `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[a.getMonth()]} ${a.getFullYear()}`;
    return `${longDate(r.from)} — ${longDate(r.to)}`;
  },

  /** Строки сметы: группировка по услуге и цене за штуку. */
  lines() {
    const r = this.range();
    // у архивных заказов без точной даты известен только месяц: берём их, если месяц входит в период целиком
    const mine = Store.orders.filter(o => o.client.trim() === this.client && (!this.onlyUnpaid || debtOf(o) > 0));
    const whole = o => monthStart(monthKey(o.date)) >= r.from && monthEnd(monthKey(o.date)) <= r.to;
    const touches = o => monthEnd(monthKey(o.date)) >= r.from && monthStart(monthKey(o.date)) <= r.to;
    const list = mine.filter(o => o.dateUnknown ? whole(o) : o.date >= r.from && o.date <= r.to);
    const undated = list.filter(o => o.dateUnknown).length;
    const skipped = mine.filter(o => o.dateUnknown && touches(o) && !whole(o));
    const skippedMonths = [...new Set(skipped.map(o => monthKey(o.date)))].map(monthTitle);
    const m = new Map();
    for (const o of list) {
      const k = serviceKey(o.service) + "|" + o.price;
      if (!m.has(k)) m.set(k, { name: o.service.trim() || "Без названия", price: o.price, qty: 0, sum: 0, received: 0, orders: [] });
      const x = m.get(k);
      x.qty++; x.sum += o.price; x.received += o.received; x.orders.push(o);
    }
    const lines = [...m.values()].sort((a, b) => b.sum - a.sum);
    const total = lines.reduce((s, x) => s + x.sum, 0), received = lines.reduce((s, x) => s + x.received, 0);
    return { r, list, lines, total, received, debt: total - received, undated, skipped: skipped.length, skippedMonths };
  },

  text(e) {
    const rows = e.lines.map(x => x.qty > 1 ? `${x.name} — ${x.qty} × ${money(x.price)} = ${money(x.sum)}` : `${x.name} — ${money(x.sum)}`);
    const tail = !this.onlyUnpaid && e.received > 0 && e.debt > 0 ? `\nОплачено: ${money(e.received)}\nК оплате: ${money(e.debt)}` : "";
    return `${this.client} — ${this.rangeLabel(e.r)}\n\n${rows.join("\n")}\n\nИтого: ${e.list.length} ${plural(e.list.length, "работа", "работы", "работ")} — ${money(e.total)}${tail}`;
  },

  render() {
    this.defaults();
    const names = clientNames().sort((a, b) => this.count(b) - this.count(a));
    const e = this.lines(), k = this.month, mName = MONTHS_GEN[+k.slice(5) - 1];
    const el = $("#page-estimates");
    el.innerHTML = `
      <div class="est-layout">
        <div class="card est-form">
          <h3>${icon("receipt")}Смета для клиента</h3>
          <label class="est-l">Клиент
            <select class="field" id="eClient">${names.map(n => `<option ${n === this.client ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
          <div class="est-l">Месяц
            <div class="month-nav sm"><button class="icon-btn sm" data-em="-1">${icon("chev-l")}</button><div class="mn-title">${monthTitle(k)}</div><button class="icon-btn sm" data-em="1">${icon("chev-r")}</button></div></div>
          <div class="est-l">Период
            <div class="seg full est-seg">
              <button data-p="h1" class="${this.preset === "h1" ? "on" : ""}">1–15</button>
              <button data-p="h2" class="${this.preset === "h2" ? "on" : ""}">16–${parseISO(monthEnd(k)).getDate()}</button>
              <button data-p="m" class="${this.preset === "m" ? "on" : ""}">Весь ${MONTHS_SHORT[+k.slice(5) - 1]}</button>
              <button data-p="custom" class="${this.preset === "custom" ? "on" : ""}">Свой</button>
            </div></div>
          ${this.preset === "custom" ? `<div class="row tight"><input type="date" class="field" id="eFrom" value="${e.r.from}"><span class="muted">—</span><input type="date" class="field" id="eTo" value="${e.r.to}"></div>` : ""}
          <div class="set-row"><div class="sr-l"><div>Только неоплаченные</div><div>Скрыть то, за что уже заплатили</div></div><button class="toggle ${this.onlyUnpaid ? "on" : ""}" id="eUnpaid"></button></div>
        </div>
        <div class="card est-result">
          <div class="est-head">
            <div><div class="est-client">${esc(this.client || "Клиент не выбран")}</div><div class="muted">${this.rangeLabel(e.r)}</div></div>
            <div class="est-total"><b>${money(e.total)}</b><span class="muted">${e.list.length} ${plural(e.list.length, "работа", "работы", "работ")}</span></div>
          </div>
          ${e.undated ? `<div class="scope-note">${icon("cal")} Учтено ${e.undated} ${plural(e.undated, "заказ", "заказа", "заказов")} из архива без точной даты — по месяцам целиком</div>` : ""}
          ${e.skipped ? `<div class="scope-note warn-note">${icon("info")} Не учтено ${e.skipped} ${plural(e.skipped, "заказ", "заказа", "заказов")} без точной даты: ${e.skippedMonths.join(", ")} попадает в период не полностью</div>` : ""}
          ${e.lines.length ? `<table class="simple est-table">
            <thead><tr><th>Услуга</th><th class="r">Кол-во</th><th class="r">Цена</th><th class="r">Сумма</th></tr></thead>
            <tbody>${e.lines.map(x => `<tr><td><i class="dot" style="background:${serviceColor(x.name) || "var(--line-2)"}"></i>${esc(x.name)}</td><td class="r">${x.qty}</td><td class="r">${money(x.price)}</td><td class="r"><b>${money(x.sum)}</b></td></tr>`).join("")}</tbody>
            <tfoot><tr><td>Итого</td><td class="r">${e.list.length}</td><td></td><td class="r"><b>${money(e.total)}</b></td></tr>
              ${!this.onlyUnpaid && e.received > 0 ? `<tr class="muted"><td>Оплачено</td><td></td><td></td><td class="r">${money(e.received)}</td></tr><tr><td>К оплате</td><td></td><td></td><td class="r ${e.debt ? "red" : ""}"><b>${money(e.debt)}</b></td></tr>` : ""}</tfoot>
          </table>
          <pre class="est-text" id="eText">${esc(this.text(e))}</pre>
          <div class="row wrap est-actions">
            <button class="btn primary" id="eCopy">${icon("copy")} Скопировать текст</button>
            ${e.debt > 0 ? `<button class="btn" id="ePaid">${icon("check")} Отметить всё оплаченным</button>` : ""}
          </div>`
          : `<div class="empty-state"><div class="es-ico">${icon("receipt")}</div><h4>За этот период работ нет</h4><div>Выберите другой период или клиента</div></div>`}
        </div>
      </div>`;
    $("#eClient").onchange = ev => { this.client = ev.target.value; this.remember(); this.render(); };
    $$("[data-em]").forEach(b => b.onclick = () => { this.month = shiftMonth(this.month, +b.dataset.em); this.render(); });
    $$(".est-seg [data-p]").forEach(b => b.onclick = () => {
      if (b.dataset.p === "custom" && this.preset !== "custom") { const r = this.range(); this.from = r.from; this.to = r.to; }
      this.preset = b.dataset.p; this.render();
    });
    $("#eFrom")?.addEventListener("change", ev => { this.from = ev.target.value; this.render(); });
    $("#eTo")?.addEventListener("change", ev => { this.to = ev.target.value; this.render(); });
    $("#eUnpaid").onclick = () => { this.onlyUnpaid = !this.onlyUnpaid; this.remember(); this.render(); };
    $("#eCopy")?.addEventListener("click", async () => {
      const text = this.text(e);
      try { await navigator.clipboard.writeText(text); toast("Смета скопирована", "Вставьте её в чат с клиентом", "ok", "copy"); }
      catch { promptBox("Смета", "Скопируйте текст вручную:", text); }
    });
    $("#ePaid")?.addEventListener("click", async () => {
      const unpaid = e.list.filter(o => debtOf(o) > 0);
      if (!await confirmBox("Отметить оплаченным?", `${unpaid.length} ${plural(unpaid.length, "заказ", "заказа", "заказов")} на ${money(e.debt)} — оплата запишется сегодняшней датой.`, "Отметить")) return;
      unpaid.forEach(o => setPaid(o, true));
      Store.commit("orders");
      this.render();
      toast("Оплачено", `${this.client}: ${money(e.debt)}`, "ok", "coin");
    });
  },

  openFor(client) { this.client = client; showTab("estimates"); },
};
