/* «Итоги года» в духе Spotify Wrapped: анимированные слайды + картинка 1080×1920 для сторис. */
function yearStats(year) {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const entries = incomeEntries(from, to), orders = ordersInRange(from, to);
  if (!orders.length && !entries.length) return null;
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const prevTotal = incomeEntries(`${year - 1}-01-01`, `${year - 1}-12-31`).reduce((s, e) => s + e.amount, 0);
  const months = Array.from({ length: 12 }, () => 0);
  entries.forEach(e => months[+e.date.slice(5, 7) - 1] += e.amount);
  const best = months.indexOf(Math.max(...months));
  const byClient = new Map(), bySvc = new Map();
  for (const o of orders) {
    const c = o.client.trim(), k = serviceKey(o.service);
    if (c) byClient.set(c, (byClient.get(c) || 0) + o.received);
    if (k) { const x = bySvc.get(k) || { name: o.service.trim(), n: 0 }; x.n++; bySvc.set(k, x); }
  }
  const topClient = [...byClient].sort((a, b) => b[1] - a[1])[0] || ["—", 0];
  const topSvc = [...bySvc.values()].sort((a, b) => b.n - a.n)[0] || { name: "—", n: 0 };
  const biggest = [...orders].sort((a, b) => b.price - a.price)[0];
  const ms = orders.reduce((s, o) => s + workMs(o), 0);
  const timed = orders.filter(o => workMs(o) >= 60000 && o.price);
  const rate = timed.length ? timed.reduce((s, o) => s + o.price, 0) / (timed.reduce((s, o) => s + workMs(o), 0) / 3600000) : 0;
  return {
    year, total, prevTotal, growth: prevTotal ? Math.round((total - prevTotal) / prevTotal * 100) : null,
    orders: orders.length, clients: byClient.size, months, best, topClient, share: total ? Math.round(topClient[1] / total * 100) : 0,
    topSvc, biggest, ms, rate,
  };
}
function wrappedYears() {
  return [...new Set(Store.orders.map(o => +o.date.slice(0, 4)))].sort((a, b) => b - a).filter(y => yearStats(y));
}

const Wrapped = {
  el: null, i: 0, timer: null, slides: [], st: null,
  open(year) {
    const st = yearStats(year);
    if (!st) return toast("Нет данных", `За ${year} год заказов нет`, "warn", "cal");
    this.st = st; this.i = 0;
    Store.local.wrappedSeen = { ...(Store.local.wrappedSeen || {}), [year]: true };
    Store.saveLocal();
    this.slides = this.build(st);
    this.el?.remove();
    const el = this.el = document.createElement("div");
    el.className = "wrapped";
    el.innerHTML = `<div class="wr-bars">${this.slides.map(() => `<i><b></b></i>`).join("")}</div>
      <button class="wr-x" title="Закрыть">${icon("x")}</button><div class="wr-stage"></div>
      <div class="wr-nav"><div data-n="-1"></div><div data-n="1"></div></div>`;
    document.body.appendChild(el);
    el.querySelector(".wr-x").onclick = () => this.close();
    el.querySelectorAll("[data-n]").forEach(z => z.onclick = () => this.go(this.i + +z.dataset.n));
    el.addEventListener("pointerdown", () => el.classList.add("hold"));
    el.addEventListener("pointerup", () => el.classList.remove("hold"));
    this.key = e => { if (e.key === "Escape") this.close(); if (e.key === "ArrowRight") this.go(this.i + 1); if (e.key === "ArrowLeft") this.go(this.i - 1); };
    document.addEventListener("keydown", this.key);
    this.go(0);
  },
  close() { clearTimeout(this.timer); document.removeEventListener("keydown", this.key); this.el?.remove(); this.el = null; },
  go(i) {
    if (i < 0) i = 0;
    if (i >= this.slides.length) return;   // на последнем слайде остаёмся
    this.i = i;
    const s = this.slides[i];
    this.el.style.setProperty("--wr-bg", s.bg);
    const stage = this.el.querySelector(".wr-stage");
    stage.innerHTML = `<div class="wr-slide">${s.html}</div>`;
    this.el.querySelectorAll(".wr-bars i").forEach((b, k) => { b.className = k < i ? "done" : k === i ? "now" : ""; });
    stage.querySelectorAll("[data-count]").forEach(n => countUp(n, +n.dataset.count, n.dataset.suffix || ""));
    stage.querySelector("[data-save]")?.addEventListener("click", e => { e.stopPropagation(); this.saveImage(); });
    stage.querySelector("[data-again]")?.addEventListener("click", e => { e.stopPropagation(); this.go(0); });
    clearTimeout(this.timer);
    this.el.style.setProperty("--wr-dur", (s.ms || 5200) + "ms");
    const tick = () => { if (!this.el) return; if (this.el.classList.contains("hold")) this.timer = setTimeout(tick, 400); else this.go(this.i + 1); };
    if (i < this.slides.length - 1) this.timer = setTimeout(tick, s.ms || 5200);
  },
  build(st) {
    const y = st.year, A = "var(--accent)";
    const maxM = Math.max(...st.months, 1);
    const slides = [
      { bg: `radial-gradient(120% 80% at 50% 0%, color-mix(in srgb, ${A} 45%, #000), #050505 70%)`, ms: 3600, html: `
        <div class="wr-logo">${logoSVG()}</div><div class="wr-kicker">ваш год в цифрах</div><div class="wr-year">${y}</div>
        <div class="wr-sub">Листайте → или подождите</div>` },
      { bg: `linear-gradient(160deg, #0b0b0b, color-mix(in srgb, ${A} 30%, #0b0b0b))`, html: `
        <div class="wr-kicker">За ${y} год вы заработали</div><div class="wr-big"><span data-count="${st.total}" data-suffix=" ₽">0 ₽</span></div>
        ${st.growth !== null ? `<div class="wr-pill ${st.growth >= 0 ? "up" : "down"}">${st.growth >= 0 ? "▲" : "▼"} ${Math.abs(st.growth)}% к ${y - 1} году</div>` : ""}
        <div class="wr-sub">≈ ${money(st.total / 12)} в месяц</div>` },
      { bg: `linear-gradient(200deg, #101010, color-mix(in srgb, #6fb6ff 28%, #0b0b0b))`, html: `
        <div class="wr-kicker">Работы было много</div>
        <div class="wr-duo"><div><b data-count="${st.orders}">0</b><span>${plural(st.orders, "заказ", "заказа", "заказов")}</span></div>
          <div><b data-count="${st.clients}">0</b><span>${plural(st.clients, "клиент", "клиента", "клиентов")}</span></div></div>
        <div class="wr-sub">в среднем ${Math.round(st.orders / 12)} заказов в месяц</div>` },
      { bg: `linear-gradient(180deg, #0b0b0b, color-mix(in srgb, #b48cff 26%, #0b0b0b))`, html: `
        <div class="wr-kicker">Лучший месяц — ${MONTHS_FULL[st.best]}</div><div class="wr-mid">${money(st.months[st.best])}</div>
        <div class="wr-chart">${st.months.map((v, k) => `<div class="wr-col ${k === st.best ? "best" : ""}" style="--h:${Math.max(3, v / maxM * 100)}%;--d:${k * 60}ms"><i></i><span>${MONTHS_SHORT[k][0]}</span></div>`).join("")}</div>` },
      { bg: `linear-gradient(150deg, color-mix(in srgb, #ff8fb1 30%, #0b0b0b), #0b0b0b)`, html: `
        <div class="wr-kicker">Главный клиент года</div><div class="wr-name">${esc(st.topClient[0])}</div>
        <div class="wr-ring" style="--p:${st.share}"><b data-count="${st.share}" data-suffix="%">0%</b><span>вашего дохода</span></div>
        <div class="wr-sub">${money(st.topClient[1])} за год</div>` },
      { bg: `linear-gradient(210deg, color-mix(in srgb, #ffb547 28%, #0b0b0b), #0b0b0b)`, html: `
        <div class="wr-kicker">Хит года</div><div class="wr-name">${esc(st.topSvc.name)}</div>
        <div class="wr-big"><span data-count="${st.topSvc.n}" data-suffix=" ${plural(st.topSvc.n, "раз", "раза", "раз")}">0</span></div>
        ${st.biggest ? `<div class="wr-sub">а самый крупный заказ — ${money(st.biggest.price)}${st.biggest.client ? ` от ${esc(st.biggest.client)}` : ""}</div>` : ""}` },
    ];
    if (st.ms >= 3600000) slides.push({ bg: `linear-gradient(170deg, #0b0b0b, color-mix(in srgb, #5ee0b5 28%, #0b0b0b))`, html: `
        <div class="wr-kicker">Время в работе</div><div class="wr-big"><span data-count="${Math.round(st.ms / 3600000)}" data-suffix=" ч">0 ч</span></div>
        ${st.rate ? `<div class="wr-sub">реальная ставка ≈ ${money(st.rate)} в час</div>` : ""}` });
    slides.push({ bg: `radial-gradient(100% 70% at 50% 100%, color-mix(in srgb, ${A} 40%, #000), #050505 70%)`, ms: 99999, html: `
        <div class="wr-final">
          ${Store.settings.showGame ? `<div class="wr-hero">${renderCharacter({ ...Store.game.equipped, stage: G.stage, animate: true })}</div>` : `<div class="wr-logo">${logoSVG()}</div>`}
          <div class="wr-kicker">Итоги ${y}</div>
          <div class="wr-grid">
            <div><b>${compactMoney(st.total)} ₽</b><span>заработано</span></div><div><b>${st.orders}</b><span>заказов</span></div>
            <div><b>${MONTHS_SHORT[st.best]}</b><span>лучший месяц</span></div><div><b>${esc(st.topClient[0])}</b><span>главный клиент</span></div>
          </div>
          <div class="row wrap center"><button class="btn primary" data-save>${icon("download")} Сохранить картинкой</button><button class="btn" data-again>Ещё раз</button></div>
        </div>` });
    return slides;
  },

  /** Картинка 1080×1920: рисуем на canvas (шрифт Inter уже загружен страницей, логотип — кривыми Path2D). */
  async saveImage() {
    const st = this.st, W = 1080, H = 1920, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d"), acc = Store.settings.accent;
    await document.fonts.ready;
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#050505"); bg.addColorStop(1, "#0d0d0d");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W / 2, 0, 0, W / 2, 0, 1100);
    glow.addColorStop(0, acc + "88"); glow.addColorStop(1, acc + "00");
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    // логотип
    x.save(); x.translate(W / 2 - 230, 150); const k = 460 / LOGO.w; x.scale(k, k); x.translate(0, -LOGO.y0);
    x.fillStyle = acc; x.fill(new Path2D(LOGO.com)); x.fillStyle = "#fff"; x.fill(new Path2D(LOGO.log)); x.restore();
    const text = (t, y, size, color = "#fff", weight = 800) => { x.font = `${weight} ${size}px Inter, sans-serif`; x.fillStyle = color; x.textAlign = "center"; x.fillText(t, W / 2, y); };
    text(`ИТОГИ ${st.year}`, 400, 48, "rgba(255,255,255,.6)", 700);
    text(money(st.total), 560, 128, acc);
    text("заработано за год", 640, 42, "rgba(255,255,255,.6)", 600);
    if (st.growth !== null) text(`${st.growth >= 0 ? "+" : "−"}${Math.abs(st.growth)}% к ${st.year - 1}`, 720, 44, st.growth >= 0 ? acc : "#ff6b6b", 700);
    // месяцы
    const maxM = Math.max(...st.months, 1), bw = 56, gap = 20, x0 = (W - (bw * 12 + gap * 11)) / 2;
    st.months.forEach((v, i) => {
      const h = Math.max(10, v / maxM * 380), px = x0 + i * (bw + gap);
      x.fillStyle = i === st.best ? acc : "rgba(255,255,255,.18)";
      x.beginPath(); x.roundRect(px, 1180 - h, bw, h, 16); x.fill();
      x.font = "600 30px Inter, sans-serif"; x.fillStyle = "rgba(255,255,255,.5)"; x.textAlign = "center";
      x.fillText(MONTHS_SHORT[i][0].toUpperCase(), px + bw / 2, 1230);
    });
    // плитки
    const tiles = [[String(st.orders), "заказов"], [String(st.clients), "клиентов"], [MONTHS_FULL[st.best], "лучший месяц"], [st.topClient[0], "главный клиент"], [st.topSvc.name, "хит года"], [st.ms >= 3600000 ? `${Math.round(st.ms / 3600000)} ч` : money(st.biggest?.price || 0), st.ms >= 3600000 ? "в работе" : "крупнейший заказ"]];
    tiles.forEach(([v, l], i) => {
      const col = i % 2, row = Math.floor(i / 2), tx = 90 + col * 470, ty = 1320 + row * 170;
      x.fillStyle = "rgba(255,255,255,.07)"; x.beginPath(); x.roundRect(tx, ty, 430, 140, 32); x.fill();
      x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 48px Inter, sans-serif";
      let val = v; while (x.measureText(val).width > 370 && val.length > 3) val = val.slice(0, -2) + "…";
      x.fillText(val, tx + 32, ty + 70);
      x.font = "600 28px Inter, sans-serif"; x.fillStyle = "rgba(255,255,255,.55)"; x.fillText(l, tx + 32, ty + 112);
    });
    text("сделано в COMLOG", 1860, 30, "rgba(255,255,255,.35)", 600);
    const blob = await new Promise(r => c.toBlob(r, "image/png"));
    const path = await saveBlob(`comlog-itogi-${st.year}.png`, blob);
    if (path) toast("Картинка сохранена", "Формат 1080×1920 — как раз для сторис", "ok", "download");
  },
};

function countUp(el, target, suffix = "") {
  const t0 = performance.now(), dur = 1400;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * e) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** В конце декабря и в январе один раз предлагаем посмотреть итоги. */
function offerWrapped() {
  const d = new Date(), m = d.getMonth(), day = d.getDate();
  const year = m === 11 && day >= 20 ? d.getFullYear() : m === 0 ? d.getFullYear() - 1 : null;
  if (!year || Store.local.wrappedSeen?.[year] || !yearStats(year)) return;
  toast(`Итоги ${year} года готовы`, "Сколько заработали, лучший месяц и клиент", "ok", "star", { label: "Смотреть", run: () => Wrapped.open(year) });
}

document.addEventListener("click", e => { const b = e.target.closest("[data-wrapped]"); if (b) Wrapped.open(+b.dataset.wrapped); });
