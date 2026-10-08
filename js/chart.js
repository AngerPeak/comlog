/* Выбор периода, разбиение на интервалы и SVG-график кривой доходов. */
const PRESETS = [
  ["7d", "Неделя"], ["30d", "Месяц"], ["90d", "3 месяца"], ["180d", "Полгода"],
  ["365d", "Год"], ["ytd", "С начала года"], ["all", "Всё время"],
];

function resolvePeriod(p) {
  const t = todayISO();
  switch (p.preset) {
    case "7d": return { from: addDays(t, -6), to: t };
    case "30d": return { from: addDays(addMonths(t, -1), 1), to: t };
    case "90d": return { from: addDays(addMonths(t, -3), 1), to: t };
    case "180d": return { from: addDays(addMonths(t, -6), 1), to: t };
    case "365d": return { from: addDays(addMonths(t, -12), 1), to: t };
    case "ytd": return { from: t.slice(0, 4) + "-01-01", to: t };
    case "all": {
      const dates = Store.orders.map(o => o.date).sort();
      const first = dates[0] && dates[0] < t ? dates[0] : addDays(t, -29);
      const last = dates.length && dates[dates.length - 1] > t ? dates[dates.length - 1] : t;
      return { from: first, to: last };
    }
    default: {
      let { from, to } = p;
      if (!from) from = addDays(t, -29);
      if (!to) to = t;
      if (from > to) [from, to] = [to, from];
      return { from, to };
    }
  }
}

function periodLabel(r) { return `${longDate(r.from)} — ${longDate(r.to)}`; }

function renderPeriodPicker(el, p, onChange) {
  const r = resolvePeriod(p);
  el.innerHTML = `
    <div class="seg scroll-x">${PRESETS.map(([k, l]) => `<button data-p="${k}" class="${p.preset === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="custom">
      <input type="date" class="field" data-f="from" value="${r.from}" title="С">
      <span class="muted">—</span>
      <input type="date" class="field" data-f="to" value="${r.to}" title="По">
    </div>`;
  el.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { p.preset = b.dataset.p; onChange(); });
  el.querySelectorAll("[data-f]").forEach(inp => inp.onchange = () => {
    if (!inp.value) return;
    const cur = resolvePeriod(p);
    p.preset = "custom"; p.from = cur.from; p.to = cur.to; p[inp.dataset.f] = inp.value;
    onChange();
  });
}

function autoGrouping(from, to) {
  const days = daysBetween(from, to) + 1;
  if (days <= 62) return "day";
  if (days <= 200) return "week";
  return "month";
}

/** entries — поступления денег (incomeEntries), orders — заказы периода (для количества и долгов). */
function buildSeries(entries, orders, from, to, grouping) {
  const buckets = [];
  if (grouping === "day") {
    for (let d = from; d <= to; d = addDays(d, 1)) buckets.push({ from: d, to: d, label: shortDate(d) });
  } else if (grouping === "week") {
    for (let d = weekStart(from); d <= to; d = addDays(d, 7)) {
      const end = addDays(d, 6);
      buckets.push({ from: d < from ? from : d, to: end > to ? to : end, label: shortDate(d < from ? from : d) });
    }
  } else {
    const multiYear = from.slice(0, 4) !== to.slice(0, 4);
    for (let k = monthKey(from); k <= monthKey(to); k = shiftMonth(k, 1)) {
      const s = monthStart(k), e = monthEnd(k), m = +k.slice(5) - 1;
      buckets.push({ from: s < from ? from : s, to: e > to ? to : e, label: multiYear ? `${MONTHS_SHORT[m]} ${k.slice(2, 4)}` : MONTHS_SHORT[m] });
    }
  }
  buckets.forEach(b => { b.value = 0; b.debt = 0; b.count = 0; b.undated = 0; });
  const at = date => {
    if (date < from || date > to) return null;
    if (grouping === "day") return buckets[daysBetween(from, date)];
    if (grouping === "week") return buckets[Math.floor(daysBetween(weekStart(from), weekStart(date)) / 7)];
    return buckets[monthsBetween(monthKey(from), monthKey(date))];
  };
  for (const e of entries) { const b = at(e.date); if (b) { b.value += e.amount; if (e.undated) b.undated++; } }
  for (const o of orders) { const b = at(o.date); if (b) { b.count++; b.debt += debtOf(o); } }
  return buckets;
}

function niceMax(v) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function monotonePath(pts) {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1); }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1] * m[i] <= 0 ? 0 : 3 * (dx[i - 1] + dx[i]) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + t[i] * h).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * h).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

let chartSeq = 0;
function drawLineChart(wrap, series, opts = {}) {
  const id = "g" + (++chartSeq);
  const draw = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H) return;
    const vals = [];
    let acc = 0;
    series.forEach(b => { acc += b.value; vals.push(opts.cumulative ? acc : b.value); });
    const total = series.reduce((s, b) => s + b.value, 0);
    const small = W < 500;
    const L = small ? 44 : 58, R = 12, T = 16, B = 30;
    const w = W - L - R, h = H - T - B;
    const max = niceMax(Math.max(...vals, 0));
    const n = series.length;
    const x = i => L + (n === 1 ? w / 2 : (i * w) / (n - 1));
    const y = v => T + h - (v / max) * h;
    const pts = vals.map((v, i) => [x(i), y(v)]);

    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const v = (max / 4) * g, yy = y(v);
      grid += `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}" ${g ? 'stroke-dasharray="3 5"' : ""}/>
               <text x="${L - 8}" y="${yy + 4}" text-anchor="end">${compactMoney(v)}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 70))));
    let xl = "";
    series.forEach((b, i) => { if (i % step === 0) xl += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${b.label}</text>`; });

    const line = monotonePath(pts);
    const area = n > 1 ? `${line} L${x(n - 1)},${T + h} L${x(0)},${T + h} Z` : "";
    const dots = n <= 45 ? pts.map(([px, py], i) => vals[i] > 0 || opts.cumulative ? `<circle cx="${px}" cy="${py}" r="3" style="fill:var(--panel);stroke:var(--accent)" stroke-width="2"/>` : "").join("") : "";

    wrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${id}a" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style="stop-color:var(--accent)" stop-opacity=".34"/><stop offset="1" style="stop-color:var(--accent)" stop-opacity="0"/>
          </linearGradient>
          <filter id="${id}f" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
        </defs>
        <g class="axis">${grid}${xl}</g>
        ${area ? `<path d="${area}" fill="url(#${id}a)"/>` : ""}
        <path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="5" opacity=".35" filter="url(#${id}f)"/>
        <path d="${line}" fill="none" style="stroke:var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        ${dots}
        <line class="hv-line" x1="0" x2="0" y1="${T}" y2="${T + h}" style="stroke:var(--muted-2)" stroke-dasharray="4 4" opacity="0"/>
        <circle class="hv-dot" r="6" style="fill:var(--accent);stroke:var(--panel)" stroke-width="3" opacity="0"/>
        <rect x="${L}" y="${T}" width="${w}" height="${h}" fill="transparent" class="hv-rect"/>
      </svg>
      <div class="chart-tip" style="opacity:0"></div>
      ${total === 0 ? `<div class="chart-empty">За этот период оплат нет</div>` : ""}`;

    const svg = wrap.querySelector("svg"), tip = wrap.querySelector(".chart-tip");
    const hl = svg.querySelector(".hv-line"), hd = svg.querySelector(".hv-dot");
    const show = clientX => {
      const rect = svg.getBoundingClientRect();
      const mx = (clientX - rect.left) * (W / rect.width);
      const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((mx - L) / w) * (n - 1))));
      const b = series[i];
      hl.setAttribute("x1", pts[i][0]); hl.setAttribute("x2", pts[i][0]); hl.setAttribute("opacity", 1);
      hd.setAttribute("cx", pts[i][0]); hd.setAttribute("cy", pts[i][1]); hd.setAttribute("opacity", 1);
      const range = b.from === b.to ? longDate(b.from) : `${shortDate(b.from)} — ${shortDate(b.to)}`;
      tip.innerHTML = `<b>${money(vals[i])}</b>${opts.cumulative ? `+${money(b.value)} · ` : ""}${range}<br><span class="muted">${b.count} ${plural(b.count, "заказ", "заказа", "заказов")}${b.debt ? ` · долг ${money(b.debt)}` : ""}</span>`;
      const left = (pts[i][0] / W) * rect.width;
      tip.style.left = Math.min(rect.width - 70, Math.max(70, left)) + "px";
      tip.style.top = (pts[i][1] / H) * rect.height + "px";
      tip.style.opacity = 1;
    };
    const hide = () => { tip.style.opacity = 0; hl.setAttribute("opacity", 0); hd.setAttribute("opacity", 0); };
    const r = svg.querySelector(".hv-rect");
    r.onmousemove = e => show(e.clientX);
    r.onmouseleave = hide;
    r.ontouchstart = r.ontouchmove = e => { show(e.touches[0].clientX); };
    r.ontouchend = () => setTimeout(hide, 1500);
  };
  draw();
  if (wrap._ro) wrap._ro.disconnect();
  let lastW = wrap.clientWidth;
  wrap._ro = new ResizeObserver(() => { if (wrap.clientWidth !== lastW) { lastW = wrap.clientWidth; draw(); } });
  wrap._ro.observe(wrap);
}

function undatedNote(series, grouping) {
  const n = series.reduce((s, b) => s + b.undated, 0);
  return n && grouping !== "month" ? `<div class="chart-note">${icon("cal")} ${n} ${plural(n, "оплата", "оплаты", "оплат")} без точной даты (архив) показаны в начале своего месяца — для точной картины выберите шаг «Месяцы»</div>` : "";
}

function barsHTML(rows, clickable = false, countLabel = false) {
  if (!rows.length) return `<div class="muted" style="padding:10px 0">Нет данных за период</div>`;
  const max = Math.max(...rows.map(r => r.value), 1);
  return `<div class="bars">${rows.map(r => `
    <div class="bar-row ${clickable ? "clickable" : ""}" ${clickable ? `data-client="${esc(r.name)}"` : ""}>
      <div class="br-top"><span>${r.color ? `<i class="dot" style="background:${r.color}"></i>` : ""}${esc(r.name)}</span><b>${money(r.value)}${countLabel ? ` <small class="muted">· ${r.count} шт.</small>` : ""}</b></div>
      <div class="br-track"><i style="width:${(r.value / max) * 100}%"></i></div>
    </div>`).join("")}</div>`;
}
