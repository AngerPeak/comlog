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
      </div>
      <div class="grid two" style="margin-top:16px" id="aExtra"></div>`;
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
    $("#aExtra").innerHTML = rateCardHTML(s.list) + speedCardHTML(r);
    $$("#aExtra [data-client]").forEach(el => el.onclick = () => ClientsView.open(el.dataset.client, this.period));
  },
};

/** Реальная ставка за час: деньги по заказам с засечённым временем / часы. */
function rateCardHTML(list) {
  const m = new Map();
  for (const o of list) {
    const ms = workMs(o);
    if (ms < 60000 || !o.price) continue;
    const k = serviceKey(o.service) || "—";
    const x = m.get(k) || { name: o.service.trim() || "Без названия", ms: 0, sum: 0, n: 0 };
    x.ms += ms; x.sum += o.price; x.n++;
    m.set(k, x);
  }
  if (!m.size) return (feat("track") || feat("hourly")) ? `<div class="card"><h3>${icon("stopwatch")}Реальная ставка за час</h3>
    <div class="muted small">Засекайте время работы (⏱ у заказа или таймер почасовой оплаты) — здесь появится, сколько вы зарабатываете за час на каждой услуге.</div></div>` : "";
  const rows = [...m.values()].map(x => ({ ...x, rate: x.sum / (x.ms / 3600000) })).sort((a, b) => b.rate - a.rate);
  const max = Math.max(...rows.map(x => x.rate));
  const totalMs = rows.reduce((a, x) => a + x.ms, 0), totalSum = rows.reduce((a, x) => a + x.sum, 0);
  return `<div class="card"><h3>${icon("stopwatch")}Реальная ставка за час<span class="sub">в среднем ${money(totalSum / (totalMs / 3600000))}/ч</span></h3>
    <div class="bars">${rows.slice(0, 8).map(x => `<div class="bar-row"><div class="br-top"><span>${esc(x.name)} <small class="muted">· ${x.n} шт., ${fmtDur(x.ms)}</small></span><b>${money(x.rate)}/ч</b></div>
      <div class="br-track"><i style="width:${x.rate / max * 100}%"></i></div></div>`).join("")}</div></div>`;
}
/** Скорость оплаты: сколько дней проходит от сдачи работы до денег. */
function speedCardHTML(r) {
  const m = new Map();
  for (const d of paymentDelays()) {
    if (d.o.date < r.from || d.o.date > r.to) continue;
    const c = d.o.client.trim() || "Без имени";
    const x = m.get(c) || { name: c, days: 0, n: 0 };
    x.days += d.days; x.n++; m.set(c, x);
  }
  if (!m.size) return `<div class="card"><h3>${icon("clock")}Скорость оплаты</h3><div class="muted small">Появится, когда у заказов будут отметки «выполнен» и оплаты с датами.</div></div>`;
  const rows = [...m.values()].map(x => ({ ...x, avg: x.days / x.n })).sort((a, b) => a.avg - b.avg);
  const max = Math.max(1, ...rows.map(x => x.avg));
  return `<div class="card"><h3>${icon("clock")}Скорость оплаты<span class="sub">дней от сдачи до оплаты</span></h3>
    <div class="bars">${rows.slice(0, 8).map(x => `<div class="bar-row clickable" data-client="${esc(x.name)}"><div class="br-top"><span>${esc(x.name)} <small class="muted">· ${x.n} ${plural(x.n, "заказ", "заказа", "заказов")}</small></span><b>${x.avg < 1 ? "сразу" : `≈ ${Math.round(x.avg)} ${plural(Math.round(x.avg), "день", "дня", "дней")}`}</b></div>
      <div class="br-track speed"><i style="width:${Math.max(4, x.avg / max * 100)}%"></i></div></div>`).join("")}</div></div>`;
}
