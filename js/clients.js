/* Вкладка «Клиенты»: доход от клиента за период, объединение дублей, «давно не заказывали». */
const ClientsView = {
  selected: null,
  search: "",
  mode: "all",          // all | dormant | dupes
  period: { preset: "all" },

  mount() {
    $("#page-clients").innerHTML = `
      <div class="clients-layout">
        <div class="card">
          <div class="seg full" id="cMode" style="margin-bottom:12px">
            <button data-m="all">Все</button><button data-m="dormant">Давно не было</button><button data-m="dupes">Дубли</button>
          </div>
          <div class="search" id="cSearchBox" style="margin-bottom:12px">${icon("search")}<input class="field" id="cSearch" placeholder="Найти клиента" style="width:100%" autocomplete="off"></div>
          <div class="client-list" id="cList"></div>
        </div>
        <div id="cDetail"></div>
      </div>`;
    $("#cSearch").oninput = e => { this.search = e.target.value.trim().toLowerCase(); this.renderList(); };
    $$("#cMode button").forEach(b => b.onclick = () => { this.mode = b.dataset.m; this.renderList(); });
  },

  aggregate() {
    const m = new Map();
    for (const o of Store.orders) {
      const n = o.client.trim();
      if (!n) continue;
      const c = m.get(n) || { name: n, count: 0, received: 0, debt: 0, last: "", first: "9999", months: new Set() };
      c.count++; c.received += o.received; c.debt += debtOf(o);
      if (o.date > c.last) c.last = o.date;
      if (o.date < c.first) c.first = o.date;
      c.months.add(monthKey(o.date));
      m.set(n, c);
    }
    return Array.from(m.values()).sort((a, b) => b.received - a.received || a.name.localeCompare(b.name, "ru"));
  },

  /** Клиенты, которые заказывали регулярно, а теперь пропали: пауза вдвое длиннее обычной и не меньше 2 месяцев. */
  dormant(all) {
    const cur = monthKey(todayISO());
    return all.filter(c => c.count >= 3).map(c => {
      const span = monthsBetween(monthKey(c.first), monthKey(c.last)) + 1;
      const every = Math.max(1, Math.round(span / c.months.size));
      const gap = monthsBetween(monthKey(c.last), cur);
      return { ...c, every, gap };
    }).filter(c => c.gap >= Math.max(2, c.every * 2)).sort((a, b) => b.received - a.received);
  },

  /** Похожие имена: «Пальм» ≈ «PALM», «Castle music» ≈ «Castle Music». */
  dupes(all) {
    const dismissed = new Set(Store.settings.dismissedDupes || []);
    const items = all.map(c => ({ ...c, loose: looseName(c.name) })).filter(c => c.loose.length >= 2);
    const groups = [], used = new Set();
    for (let i = 0; i < items.length; i++) {
      if (used.has(i)) continue;
      const g = [items[i]];
      for (let j = i + 1; j < items.length; j++) {
        if (used.has(j)) continue;
        const a = items[i].loose, b = items[j].loose;
        const close = a === b || (Math.min(a.length, b.length) >= 5 && levenshtein(a, b) <= 1);
        if (close) { g.push(items[j]); used.add(j); }
      }
      if (g.length > 1) {
        const id = g.map(x => x.name).sort().join("|");
        if (!dismissed.has(id)) groups.push({ id, items: g.sort((a, b) => b.count - a.count) });
      }
    }
    return groups;
  },

  open(name, period) {
    this.selected = name; this.mode = "all";
    if (period) this.period = { ...period };
    showTab("clients");
  },

  render() {
    const all = this.aggregate();
    if (!this.selected || !all.some(c => c.name === this.selected)) this.selected = all[0]?.name || null;
    this.renderList(all);
    this.renderDetail();
  },

  renderList(all = this.aggregate()) {
    const dupes = this.dupes(all), dormant = this.dormant(all);
    $$("#cMode button").forEach(b => {
      b.classList.toggle("on", b.dataset.m === this.mode);
      const n = b.dataset.m === "dupes" ? dupes.length : b.dataset.m === "dormant" ? dormant.length : 0;
      b.innerHTML = { all: "Все", dormant: "Давно не было", dupes: "Дубли" }[b.dataset.m] + (n ? ` <em>${n}</em>` : "");
    });
    $("#cSearchBox").hidden = this.mode === "dupes";
    const box = $("#cList");
    if (this.mode === "dupes") {
      box.innerHTML = dupes.length ? dupes.map(g => `
        <div class="dupe" data-id="${esc(g.id)}">
          <div class="muted small">Похоже на одного клиента:</div>
          ${g.items.map(c => `<div class="dupe-name"><b>${esc(c.name)}</b><span class="muted">${c.count} · ${compactMoney(c.received)} ₽</span></div>`).join("")}
          <div class="row tight" style="margin-top:10px">
            <select class="field sm">${g.items.map(c => `<option>${esc(c.name)}</option>`).join("")}</select>
            <button class="btn sm primary" data-merge>Объединить</button>
            <button class="btn sm ghost" data-skip title="Это разные клиенты">Не дубль</button>
          </div></div>`).join("")
        : `<div class="muted" style="padding:20px 8px;text-align:center">Похожих имён не нашлось 👌</div>`;
      $$("#cList .dupe").forEach(el => {
        const g = dupes.find(x => x.id === el.dataset.id);
        el.querySelector("[data-merge]").onclick = () => this.merge(g.items.map(c => c.name), el.querySelector("select").value);
        el.querySelector("[data-skip]").onclick = () => { (Store.settings.dismissedDupes ||= []).push(g.id); Store.commit("settings"); this.renderList(); };
      });
      return;
    }
    let list = this.mode === "dormant" ? dormant : all;
    if (this.search) list = list.filter(c => c.name.toLowerCase().includes(this.search));
    box.innerHTML = list.length ? list.map(c => `
      <div class="client-item ${c.name === this.selected ? "on" : ""}" data-name="${esc(c.name)}">
        <div class="avatar-l" style="background:${avaColor(c.name)}">${esc(initials(c.name))}</div>
        <div class="ci-main"><div class="ci-name">${esc(c.name)}</div>
          <div class="ci-sub">${this.mode === "dormant" ? `нет заказов ${c.gap} мес · обычно раз в ${c.every} мес` : `${c.count} ${plural(c.count, "заказ", "заказа", "заказов")} · ${monthShortTitle(monthKey(c.last))}`}</div></div>
        <div class="ci-sum">${compactMoney(c.received)} ₽${c.debt ? `<small>долг ${compactMoney(c.debt)}</small>` : ""}</div>
      </div>`).join("")
      : `<div class="muted" style="padding:20px 8px;text-align:center">${this.mode === "dormant" ? "Все постоянные клиенты на связи" : all.length ? "Никого не нашли" : "Клиенты появятся, когда вы добавите заказы"}</div>`;
    $$("#cList .client-item").forEach(el => el.onclick = () => {
      this.selected = el.dataset.name; this.renderList(all); this.renderDetail();
      if (isMobile()) $("#cDetail").scrollIntoView({ behavior: "smooth" });
    });
  },

  renderDetail() {
    const box = $("#cDetail");
    const name = this.selected;
    if (!name) { box.innerHTML = `<div class="card empty-state"><div class="es-ico">${icon("users")}</div><h4>Пока нет клиентов</h4><div>Заполните имя клиента в заказе</div></div>`; return; }
    const allOrders = Store.orders.filter(o => o.client.trim() === name);
    const first = allOrders.map(o => o.date).sort()[0];
    box.innerHTML = `
      <div class="card">
        <div class="client-head">
          <div class="avatar-l" style="background:${avaColor(name)}">${esc(initials(name))}</div>
          <div style="min-width:0"><h2>${esc(name)}</h2><div class="muted">клиент с ${first ? monthTitle(monthKey(first)) : "—"} · всего ${allOrders.length} ${plural(allOrders.length, "заказ", "заказа", "заказов")}</div></div>
          <div class="spacer"></div>
          <button class="btn sm" id="cMerge">${icon("merge")} Объединить</button>
          <button class="btn sm" id="cRename">${icon("edit")} Переименовать</button>
        </div>
        <div class="period" id="cPeriod"></div>
      </div>
      <div class="kpis" id="cKpis"></div>
      <div class="card chart-card" style="margin-top:16px"><h3>${icon("chart")}Доход от клиента<span class="sub" id="cRange"></span></h3><div class="chart-wrap sm" id="cChart"></div></div>
      <div class="card" style="margin-top:16px"><h3>${icon("list")}Заказы за период<span class="sub" id="cCount"></span></h3><div id="cTable" class="table-scroll"></div></div>`;
    $("#cRename").onclick = () => this.rename(name);
    $("#cMerge").onclick = () => this.mergeInto(name);
    renderPeriodPicker($("#cPeriod"), this.period, () => this.renderDetail());

    const r = resolvePeriod(this.period);
    const s = rangeStats(r.from, r.to, name);
    const list = s.list.sort((a, b) => b.date.localeCompare(a.date));
    $("#cKpis").innerHTML = `
      <div class="card kpi hero-kpi"><div class="k-label">${icon("coin")}Получено</div><div class="k-val">${fmt(s.received)}<small>₽</small></div></div>
      <div class="card kpi"><div class="k-label">${icon("clock")}Долг</div><div class="k-val ${s.debt ? "red" : ""}">${fmt(s.debt)}<small>₽</small></div></div>
      <div class="card kpi"><div class="k-label">${icon("list")}Заказов</div><div class="k-val">${s.count}</div></div>
      <div class="card kpi"><div class="k-label">${icon("bolt")}Средний чек</div><div class="k-val">${fmt(s.avg)}<small>₽</small></div></div>`;
    $("#cRange").textContent = periodLabel(r);
    drawLineChart($("#cChart"), buildSeries(s.entries, s.list, r.from, r.to, autoGrouping(r.from, r.to)), { cumulative: true });
    $("#cCount").textContent = `${list.length} шт.`;
    $("#cTable").innerHTML = list.length ? `<table class="simple">
      <thead><tr><th>Дата</th><th>Услуга</th><th class="r">Прайс</th><th class="r">Получено</th><th>Статус</th><th>Дедлайн</th></tr></thead>
      <tbody>${list.map(o => `<tr data-go="${o.id}" style="cursor:pointer">
        <td><span class="date-chip ${o.dateUnknown ? "unknown" : ""}">${orderDateLabel(o)}</span>${o.dateUnknown ? ` <span class="muted small">${monthShortTitle(monthKey(o.date))}</span>` : ""}</td><td>${esc(o.service || "—")}</td>
        <td class="r">${money(o.price)}</td><td class="r ${o.paid ? "lime" : ""}">${money(o.received)}</td>
        <td>${o.paid ? `<span class="tag lime">оплачен</span>` : debtOf(o) ? `<span class="tag red">долг ${money(debtOf(o))}</span>` : ""} ${o.done ? `<span class="tag">выполнен</span>` : `<span class="tag orange">в работе</span>`}</td>
        <td>${o.deadline ? `<span class="date-chip">${shortDate(o.deadline)}</span> ${deadlineBadge(o)}` : "—"}</td></tr>`).join("")}</tbody></table>`
      : `<div class="muted" style="padding:10px 0">В выбранном периоде заказов нет</div>`;
    $$("#cTable [data-go]").forEach(tr => tr.onclick = () => OrdersView.goTo(tr.dataset.go));
  },

  merge(names, target) {
    let n = 0;
    Store.orders.forEach(o => { if (names.includes(o.client.trim()) && o.client.trim() !== target) { o.client = target; n++; } });
    Store.state.templates.forEach(t => { if (names.includes(t.client)) t.client = target; });
    this.selected = target;
    Store.commit("orders");
    this.render();
    toast("Клиенты объединены", `${target}: перенесено ${n} ${plural(n, "заказ", "заказа", "заказов")}`, "ok", "merge");
  },
  async mergeInto(name) {
    const v = await promptBox("Объединить с клиентом", `Все заказы «${name}» перейдут к выбранному клиенту.`, "", "client");
    if (!v || v === name) return;
    this.merge([name, v], v);
  },
  async rename(oldName) {
    const v = await promptBox("Переименовать клиента", "Имя изменится во всех заказах. Если такой клиент уже есть — записи объединятся.", oldName);
    if (!v || v === oldName) return;
    this.merge([oldName], v);
  },
};
