/* Выпадающие подсказки для полей «Клиент» и «Услуга» (data-ac="client|service").
   Услуги из прайс-листа идут первыми; лишние подсказки можно скрыть крестиком. */
const AC = {
  box: null, input: null, items: [], idx: -1,

  init() {
    this.box = document.createElement("div");
    this.box.className = "ac-box";
    this.box.hidden = true;
    document.body.appendChild(this.box);
    document.addEventListener("focusin", e => { if (e.target.matches?.("[data-ac]")) this.open(e.target); });
    document.addEventListener("input", e => { if (e.target === this.input) this.refresh(); });
    document.addEventListener("focusout", e => { if (e.target === this.input) setTimeout(() => { if (document.activeElement !== this.input) this.close(); }, 120); });
    document.addEventListener("keydown", e => {
      if (!this.isOpen() || e.target !== this.input) return;
      if (e.key === "ArrowDown") { e.preventDefault(); this.move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.move(-1); }
      else if (e.key === "Enter" && this.idx >= 0) { e.preventDefault(); e.stopPropagation(); this.pick(this.items[this.idx]); }
      else if (e.key === "Escape") { e.stopPropagation(); this.close(); }
    }, true);
    window.addEventListener("resize", () => this.close());
    document.addEventListener("scroll", e => { if (this.isOpen() && !this.box.contains(e.target)) this.place(); }, true);
    this.box.addEventListener("pointerdown", e => e.preventDefault());   // не терять фокус поля
    this.box.addEventListener("click", e => {
      const hide = e.target.closest("[data-hide]");
      if (hide) {
        const key = hide.dataset.hide;
        serviceMeta(key).hidden = true;
        Store.commit("services");
        toast("Убрано из подсказок", "Вернуть можно во вкладке «Прайс-лист»", "ok", "x");
        this.refresh();
        return;
      }
      const it = e.target.closest("[data-i]");
      if (it) this.pick(this.items[+it.dataset.i]);
    });
  },
  isOpen() { return this.box && !this.box.hidden; },

  open(input) { this.input = input; this.refresh(); },
  close() { if (this.box) this.box.hidden = true; this.input = null; this.idx = -1; },

  source(kind, q) {
    q = q.trim().toLowerCase();
    const match = s => !q || s.toLowerCase().includes(q);
    if (kind === "client") {
      const cnt = new Map();
      Store.orders.forEach(o => { const c = o.client.trim(); if (c) cnt.set(c, (cnt.get(c) || 0) + 1); });
      return [...cnt].filter(([n]) => match(n) && n.toLowerCase() !== q).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([name, count]) => ({ name, sub: `${count} ${plural(count, "заказ", "заказа", "заказов")}` }));
    }
    const cat = serviceCatalog();
    const tpl = cat.filter(s => s.template && s.template.qty <= 1 && match(s.name))
      .map(s => ({ name: s.template.service, price: s.template.price, color: s.color, sub: "прайс-лист", tpl: true }));
    const rest = cat.filter(s => !s.template && !s.hidden && match(s.name) && s.name.toLowerCase() !== q)
      .sort((a, b) => b.count - a.count).slice(0, 12)
      .map(s => ({ name: s.name, key: s.key, color: s.color, price: s.lastPrice, sub: `${s.count} раз` }));
    return [...tpl, ...rest].slice(0, 14);
  },

  refresh() {
    if (!this.input) return;
    const kind = this.input.dataset.ac;
    this.items = this.source(kind, this.input.value);
    this.idx = -1;
    if (!this.items.length) { this.box.hidden = true; return; }
    const colors = Store.settings.serviceColors;
    this.box.innerHTML = this.items.map((it, i) => `
      <div class="ac-item" data-i="${i}">
        ${kind === "service" ? `<i class="dot" style="background:${colors && it.color ? it.color : "transparent"}"></i>` : ""}
        <span class="ac-name">${esc(it.name)}</span>
        <span class="ac-sub">${it.price ? money(it.price) + " · " : ""}${esc(it.sub)}</span>
        ${it.key ? `<button class="ac-x" data-hide="${esc(it.key)}" title="Убрать из подсказок">${icon("x")}</button>` : ""}
      </div>`).join("")
      + (kind === "service" ? `<div class="ac-foot">${icon("x")} — убрать лишнее из подсказок</div>` : "");
    this.box.hidden = false;
    this.place();
  },
  place() {
    if (!this.input || !this.input.isConnected) return this.close();
    const r = this.input.getBoundingClientRect();
    const w = Math.max(r.width, 280);
    this.box.style.width = w + "px";
    this.box.style.left = Math.min(window.innerWidth - w - 8, r.left) + "px";
    const below = window.innerHeight - r.bottom;
    const h = Math.min(this.box.scrollHeight, 340);
    this.box.style.top = (below < h + 12 && r.top > h + 12 ? r.top - h - 6 : r.bottom + 6) + "px";
  },
  move(d) {
    this.idx = (this.idx + d + this.items.length) % this.items.length;
    $$(".ac-item", this.box).forEach((el, i) => el.classList.toggle("on", i === this.idx));
    $$(".ac-item", this.box)[this.idx]?.scrollIntoView({ block: "nearest" });
  },
  pick(it) {
    const inp = this.input;
    if (!inp || !it) return;
    inp.value = it.name;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    this.close();
    const next = inp.closest("tr, .sheet-grid, .form-grid")?.querySelector(`[data-f="${inp.dataset.f === "client" ? "service" : "price"}"]`);
    if (next) next.focus();
  },
};
