/* Вкладка «Прайс-лист»: шаблоны услуг с ценами и управление подсказками/цветами услуг. */
const PriceListView = {
  search: "",
  show: "visible",   // visible | hidden | all

  render() {
    const tpls = Store.state.templates;
    const el = $("#page-pricelist");
    el.innerHTML = `
      <div class="card">
        <h3>${icon("tag")}Шаблоны<span class="sub">цена подставится сама, когда выберете услугу в заказе</span></h3>
        <div class="tpl-grid">
          ${tpls.map(t => {
            const c = serviceColor(t.service) || Store.state.services[serviceKey(t.service)]?.color || "";
            return `<div class="tpl-card" data-id="${t.id}" style="${c ? `--svc:${c}` : ""}">
              <div class="tc-top"><i class="dot" style="background:${c || "var(--line-2)"}"></i><b>${t.qty > 1 ? `${t.qty} × ` : ""}${esc(t.service || "Без названия")}</b>${t.qty > 1 ? `<span class="tag lime">пакет</span>` : ""}</div>
              <div class="tc-price">${money(t.price)}</div>
              <div class="tc-sub">${t.qty > 1 ? `${money(Math.round(t.price / t.qty))} за штуку · ` : ""}${t.client ? esc(t.client) : "любой клиент"}</div>
              <div class="tc-acts">
                <button class="btn sm primary" data-a="add" title="Добавить заказ в текущий месяц">${icon("plus")} В заказы</button>
                <button class="mini-ico" data-a="edit" title="Изменить">${icon("edit")}</button>
                <button class="mini-ico del" data-a="del" title="Удалить шаблон">${icon("trash")}</button>
              </div></div>`;
          }).join("")}
          <button class="tpl-card tpl-new" id="tplNew">${icon("plus")}<span>Новый шаблон</span></button>
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <h3>${icon("list")}Услуги в подсказках<span class="sub">скройте лишнее и раскрасьте нужное</span></h3>
        <div class="toolbar" style="margin:0 0 12px">
          <div class="search">${icon("search")}<input class="field" id="svcSearch" placeholder="Найти услугу" value="${esc(this.search)}" autocomplete="off"></div>
          <div class="seg" id="svcShow"><button data-s="visible">В подсказках</button><button data-s="hidden">Скрытые</button><button data-s="all">Все</button></div>
          <div class="spacer"></div>
          <button class="btn sm" id="svcHideRare" title="Скрыть услуги, которые встречались один раз">${icon("x")} Скрыть разовые</button>
        </div>
        <div id="svcList"></div>
      </div>`;
    $("#tplNew").onclick = () => this.editTemplate();
    $$("#page-pricelist .tpl-card[data-id]").forEach(card => card.onclick = e => {
      const t = tpls.find(x => x.id === card.dataset.id), a = e.target.closest("[data-a]")?.dataset.a;
      if (a === "add") {
        showTab("orders");
        if (t.qty > 1) OrdersView.addMany({ client: t.client, service: t.service, date: OrdersView.newDate() }, t.qty, packagePrices(t.price, t.qty));
        else OrdersView.add({ client: t.client, service: t.service, price: t.price });
      }
      else if (a === "del") this.deleteTemplate(t);
      else this.editTemplate(t);
    });
    $("#svcSearch").oninput = e => { this.search = e.target.value.trim().toLowerCase(); this.renderServices(); };
    $$("#svcShow button").forEach(b => b.onclick = () => { this.show = b.dataset.s; this.renderServices(); });
    $("#svcHideRare").onclick = async () => {
      const rare = serviceCatalog().filter(s => s.count <= 1 && !s.template && !s.hidden);
      if (!rare.length) return toast("Разовых услуг нет", "", "ok", "check");
      if (!await confirmBox(`Скрыть ${rare.length} ${plural(rare.length, "услугу", "услуги", "услуг")}?`, "Они встречались по одному разу. Заказы останутся как есть — услуги лишь пропадут из подсказок.", "Скрыть")) return;
      rare.forEach(s => serviceMeta(s.key).hidden = true);
      Store.commit("services"); this.renderServices();
    };
    this.renderServices();
  },

  renderServices() {
    $$("#svcShow button").forEach(b => b.classList.toggle("on", b.dataset.s === this.show));
    let list = serviceCatalog().sort((a, b) => b.count - a.count);
    if (this.show === "visible") list = list.filter(s => !s.hidden);
    if (this.show === "hidden") list = list.filter(s => s.hidden);
    if (this.search) list = list.filter(s => s.name.toLowerCase().includes(this.search));
    $("#svcList").innerHTML = list.length ? `<table class="simple svc-table">
      <thead><tr><th style="width:44px">Цвет</th><th>Услуга</th><th class="r">Заказов</th><th class="r">Получено</th><th class="r">Последняя цена</th><th></th></tr></thead>
      <tbody>${list.map(s => `<tr data-key="${esc(s.key)}" class="${s.hidden ? "is-hidden" : ""}">
        <td><button class="swatch" data-a="color" style="background:${s.color || "transparent"}" title="Цвет услуги">${s.color ? "" : icon("plus")}</button></td>
        <td><b>${esc(s.name)}</b>${s.names.size > 1 ? `<div class="muted small">варианты: ${[...s.names.keys()].map(esc).join(", ")}</div>` : ""}${s.template ? ` <span class="tag lime">в прайсе</span>` : ""}</td>
        <td class="r">${s.count}</td><td class="r">${money(s.total)}</td><td class="r">${s.lastPrice ? money(s.lastPrice) : "—"}</td>
        <td><div class="acts">
          ${s.template ? "" : `<button class="mini-ico" data-a="tpl" title="Добавить в прайс-лист">${icon("tag")}</button>`}
          <button class="mini-ico" data-a="rename" title="Переименовать / объединить">${icon("edit")}</button>
          <button class="btn sm ${s.hidden ? "primary" : "ghost"}" data-a="hide">${s.hidden ? "Вернуть" : "Скрыть"}</button>
        </div></td></tr>`).join("")}</tbody></table>`
      : `<div class="muted" style="padding:10px 2px">${this.show === "hidden" ? "Скрытых услуг нет" : "Услуг пока нет — они появятся из заказов"}</div>`;
    $$("#svcList tr[data-key]").forEach(tr => tr.onclick = async e => {
      const a = e.target.closest("[data-a]")?.dataset.a, key = tr.dataset.key;
      const s = serviceCatalog().find(x => x.key === key);
      if (!a || !s) return;
      if (a === "hide") { serviceMeta(key).hidden = !s.hidden; Store.commit("services"); this.renderServices(); }
      if (a === "color") {
        const c = await pickColor(e.target.closest("[data-a]"), s.color);
        if (c === null) return;
        serviceMeta(key).color = c; Store.commit("services"); this.render();
      }
      if (a === "tpl") { Store.state.templates.push(normalizeTemplate({ service: s.name, price: s.lastPrice })); Store.commit("templates"); this.render(); toast("Добавлено в прайс-лист", s.name, "ok", "tag"); }
      if (a === "rename") this.renameService(s);
    });
  },

  async renameService(s) {
    const v = await promptBox("Переименовать услугу", `Название изменится во всех ${s.count} ${plural(s.count, "заказе", "заказах", "заказах")}. Если ввести название другой услуги — они объединятся.`, s.name, "service");
    if (!v || v === s.name) return;
    const newKey = serviceKey(v);
    Store.orders.forEach(o => { if (serviceKey(o.service) === s.key) o.service = v; });
    Store.state.templates.forEach(t => { if (serviceKey(t.service) === s.key) t.service = v; });
    if (newKey !== s.key && Store.state.services[s.key]) {
      const old = Store.state.services[s.key], cur = serviceMeta(newKey);
      if (!cur.color && old.color) cur.color = old.color;
      delete Store.state.services[s.key];
    }
    Store.commit("services");
    this.render();
    toast("Услуга переименована", v, "ok", "edit");
  },

  editTemplate(t = null) {
    const isNew = !t;
    t = t || { service: "", price: 0, client: "", qty: 1 };
    const m = openModal(`<h3>${isNew ? "Новый шаблон" : "Шаблон"}</h3><p>Выбирайте его в поле «Услуга» — цена подставится автоматически.</p>
      <div class="form-grid">
        <label>Услуга<input class="field" data-f="service" data-ac="service" value="${esc(t.service)}" autocomplete="off"></label>
        <label>Цена, ₽ <small class="muted">за весь пакет</small><input class="field" data-f="price" inputmode="numeric" value="${t.price ? fmt(t.price) : ""}"></label>
        <label>Штук в пакете <small class="muted">1 — обычный шаблон</small><input class="field" data-f="qty" type="number" min="1" max="99" value="${t.qty || 1}"></label>
        <div class="muted small pkg-hint" id="pkgHint"></div>
        <label class="span2">Клиент <small class="muted">необязательно — тогда цена только для него</small><input class="field" data-f="client" data-ac="client" value="${esc(t.client)}" autocomplete="off"></label>
      </div>
      <div class="m-actions"><button class="btn" data-r="0">Отмена</button><button class="btn primary" data-r="1">Сохранить</button></div>`);
    const val = f => m.querySelector(`[data-f="${f}"]`).value.trim();
    m.querySelector('[data-f="service"]').addEventListener("change", () => {
      const pi = m.querySelector('[data-f="price"]');
      if (!parseMoney(pi.value)) { const p = suggestPrice(val("client"), val("service")); if (p) pi.value = fmt(p); }
    });
    const hint = () => { const q = parseInt(val("qty")) || 1, p = parseMoney(val("price")); $("#pkgHint").textContent = q > 1 && p ? `Создаст ${q} заказов по ${money(Math.round(p / q))}` : ""; };
    m.querySelectorAll('[data-f="qty"], [data-f="price"]').forEach(i => i.addEventListener("input", hint)); hint();
    m.querySelector('[data-r="0"]').onclick = closeModal;
    m.querySelector('[data-r="1"]').onclick = () => {
      if (!val("service")) return toast("Укажите услугу", "", "warn", "edit");
      const data = { service: val("service"), price: parseMoney(val("price")), client: val("client"), qty: Math.max(1, Math.min(99, parseInt(val("qty")) || 1)) };
      if (isNew) Store.state.templates.push(normalizeTemplate(data)); else Object.assign(t, data);
      closeModal(); Store.commit("templates"); this.render();
    };
  },
  deleteTemplate(t) {
    const idx = Store.state.templates.indexOf(t);
    Store.state.templates.splice(idx, 1);
    Store.commit("templates"); this.render();
    toast("Шаблон удалён", t.service, "ok", "trash", { label: "Отменить", run: () => { Store.state.templates.splice(idx, 0, t); Store.commit("templates"); this.render(); } });
  },
};
