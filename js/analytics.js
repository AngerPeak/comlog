/* Вкладка «Аналитика»: доход за произвольный период, график кривой, топы и счётчики. */
const AnalyticsView = {
  period: { preset: "90d" },
  client: "",
  grouping: "auto",
  cumulative: false,

  mount() {
    $("#page-analytics").innerHTML = `
      <div class="period" id="aPeriod"></div>
      <div class="toolbar" style="margin-top:14px">
        <select class="field" id="aClient" style="min-width:220px"></select>
        <div class="seg" id="aGroup">
          <button data-g="auto">Авто</button><button data-g="day">Дни</button><button data-g="week">Недели</button><button data-g="month">Месяцы</button>
        </div>
        <div class="seg" id="aMode"><button data-c="0">По периодам</button><button data-c="1">Накопительно</button></div>
        <div class="spacer"></div>
        <span class="muted small" id="aBy"></span>
      </div>
      <div class="kpis" id="aKpis"></div>
      <div class="card chart-card" style="margin-top:16px">
        <h3>${icon("chart")}Доход по датам<span class="sub" id="aRange"></span></h3>
        <div class="chart-wrap" id="aChart"></div>
        <div id="aNote"></div>
      </div>
      <div class="grid two" style="margin-top:16px">
        <div class="card"><h3>${icon("users")}Топ клиентов<span class="sub">нажмите, чтобы открыть</span></h3><div id="aTopClients"></div></div>
        <div class="card"><h3>${icon("star")}Топ услуг<span class="sub">доход и количество</span></h3><div id="aTopServices"></div></div>
      </div>`;
    $("#aClient").onchange = e => { this.client = e.target.value; this.render(); };
    $$("#aGroup button").forEach(b => b.onclick = () => { this.grouping = b.dataset.g; this.render(); });
    $$("#aMode button").forEach(b => b.onclick = () => { this.cumulative = b.dataset.c === "1"; this.render(); });
  },

  render() {
    renderPeriodPicker($("#aPeriod"), this.period, () => this.render());
    const names = clientNames();
    if (this.client && !names.includes(this.client)) this.client = "";
    $("#aClient").innerHTML = `<option value="">Все клиенты</option>` + names.map(n => `<option ${n === this.client ? "selected" : ""}>${esc(n)}</option>`).join("");
    $$("#aGroup button").forEach(b => b.classList.toggle("on", b.dataset.g === this.grouping));
    $$("#aMode button").forEach(b => b.classList.toggle("on", (b.dataset.c === "1") === this.cumulative));
    $("#aBy").textContent = Store.settings.incomeBy === "payment" ? "доход по дате оплаты" : "доход по дате заказа";

    const r = resolvePeriod(this.period);
    const s = rangeStats(r.from, r.to, this.client || null);
    const days = daysBetween(r.from, r.to) + 1, tax = Store.settings.taxEnabled;
    $("#aKpis").innerHTML = `
      <div class="card kpi hero-kpi"><div class="k-label">${icon("coin")}Доход за период</div><div class="k-val">${fmt(s.received)}<small>₽</small></div>
        <div class="k-foot">≈ ${money(s.received / Math.max(1, days / 30.44))} в месяц</div></div>
      <div class="card kpi"><div class="k-label">${icon("clock")}Не выплачено</div><div class="k-val ${s.debt ? "red" : ""}">${fmt(s.debt)}<small>₽</small></div>
        <div class="k-foot">назначено ${money(s.price)}</div></div>
      <div class="card kpi"><div class="k-label">${icon("list")}Заказов</div><div class="k-val">${s.count}</div>
        <div class="k-foot">выполнено ${s.done}, оплачено ${s.paid}</div></div>
      <div class="card kpi"><div class="k-label">${icon("bolt")}Средний чек</div><div class="k-val">${fmt(s.avg)}<small>₽</small></div>
        <div class="k-foot">${days} ${plural(days, "день", "дня", "дней")} в периоде</div></div>
      ${tax ? `<div class="card kpi"><div class="k-label">${icon("receipt")}Налог ${Store.settings.taxRate}%</div><div class="k-val">${fmt(s.tax)}<small>₽</small></div>
        <div class="k-foot">на руки ${money(s.received - s.tax)}</div></div>` : ""}`;

    const g = this.grouping === "auto" ? autoGrouping(r.from, r.to) : this.grouping;
    const series = buildSeries(s.entries, s.list, r.from, r.to, g);
    $("#aRange").textContent = periodLabel(r) + (this.client ? ` · ${this.client}` : "");
    drawLineChart($("#aChart"), series, { cumulative: this.cumulative });
    $("#aNote").innerHTML = undatedNote(series, g);

    const top = key => {
      const m = new Map();
      for (const e of s.entries) {
        const name = e.o[key].trim() || "Без названия", k = key === "service" ? serviceKey(name) || name : name;
        const x = m.get(k) || { name, value: 0, ids: new Set(), color: key === "service" ? serviceColor(name) : "" };
        x.value += e.amount; x.ids.add(e.o.id); m.set(k, x);
      }
      if (key === "service") for (const o of s.list) { const k = serviceKey(o.service); if (m.has(k)) m.get(k).ids.add(o.id); }
      return [...m.values()].map(x => ({ ...x, count: x.ids.size })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
    };
    $("#aTopClients").innerHTML = barsHTML(top("client"), true);
    $("#aTopServices").innerHTML = barsHTML(top("service"), false, true);
    $$("#aTopClients [data-client]").forEach(el => el.onclick = () => ClientsView.open(el.dataset.client, this.period));
  },
};
