/* Импорт заказов из Excel или CSV: выбор листа, сопоставление столбцов, предпросмотр. */
const IMPORT_FIELDS = [
  ["client", "Клиент", /клиент|заказчик|client|customer/i],
  ["service", "Услуга", /услуг|тех\.?\s*зад|задач|работ|service|описан|наименов/i],
  ["price", "Цена / прайс", /прайс|цена|стоим|сумм|price|amount|руб/i],
  ["received", "Получено", /получен|поступ|received/i],
  ["debt", "Долг", /долг|debt|к оплате/i],
  ["date", "Дата", /^дата|date|^день/i],
  ["done", "Выполнен (галочка)", /статус|выполн|сдан|готов|done|status/i],
  ["paid", "Оплачен (галочка)", /^оплачен|^paid/i],
  ["deadline", "Дедлайн", /дедлайн|срок|deadline/i],
  ["note", "Заметка", /коммент|замет|примеч|note/i],
];

const Importer = {
  wb: null, rows: [], head: 0, map: {}, opts: {},

  async open() {
    const file = await new Promise(resolve => {
      const inp = document.createElement("input");
      inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,.ods,text/csv";
      inp.onchange = () => resolve(inp.files[0] || null);
      inp.click();
    });
    if (!file) return;
    try {
      await loadScript("vendor/xlsx.mini.min.js");
      const buf = await file.arrayBuffer();
      this.wb = XLSX.read(buf, { type: "array", cellDates: true });
      this.file = file.name;
      this.pickSheet(this.wb.SheetNames[0]);
    } catch (e) { console.error(e); toast("Не удалось прочитать файл", e.message || String(e), "err", "x"); }
  },

  pickSheet(name) {
    this.sheet = name;
    this.rows = XLSX.utils.sheet_to_json(this.wb.Sheets[name], { header: 1, raw: true, defval: "" });
    // строка заголовков — первая, где хотя бы два текстовых значения
    this.head = Math.max(0, this.rows.findIndex(r => r.filter(v => typeof v === "string" && v.trim()).length >= 2));
    const hdr = (this.rows[this.head] || []).map(v => String(v).trim());
    this.map = {};
    const used = new Set();
    for (const [k, , re] of IMPORT_FIELDS) {
      const i = hdr.findIndex((h, j) => h && !used.has(j) && re.test(h));
      if (i >= 0) { this.map[k] = i; used.add(i); }
    }
    this.opts = { archive: true, allPaid: this.map.received === undefined && this.map.debt === undefined && this.map.paid === undefined, month: monthKey(todayISO()) };
    this.render();
  },

  cols() {
    const hdr = this.rows[this.head] || [], n = Math.max(...this.rows.slice(this.head, this.head + 50).map(r => r.length), 0);
    return Array.from({ length: n }, (_, i) => ({ i, name: `${colLetter(i)} · ${String(hdr[i] ?? "").trim() || "без названия"}` }));
  },

  /** Превратить строки таблицы в заказы по выбранному сопоставлению. */
  build() {
    const get = (r, k) => this.map[k] === undefined ? "" : r[this.map[k]];
    const out = [];
    for (const r of this.rows.slice(this.head + 1)) {
      const client = String(get(r, "client") ?? "").trim(), service = String(get(r, "service") ?? "").trim();
      if (/^(итого|всего|сумма)/i.test(client)) continue;
      const price0 = toMoney(get(r, "price")), debt = toMoney(get(r, "debt"));
      if (!client && !service && !price0 && !debt) continue;
      let received, price = price0;
      if (this.map.received !== undefined) received = toMoney(get(r, "received"));
      else if (this.map.debt !== undefined && !this.opts.priceIsAssigned) { received = price0; price = price0 + debt; }   // как в таблице «Прайс + Долг»
      else if (this.map.paid !== undefined) received = toBool(get(r, "paid")) ? price : 0;
      else received = this.opts.allPaid ? price : 0;
      if (this.map.debt !== undefined && this.opts.priceIsAssigned) received = Math.max(0, price - debt);
      const date = toDate(get(r, "date")), dl = toDate(get(r, "deadline"));
      const doneV = get(r, "done");
      out.push({
        client, service, price,
        payments: received > 0 ? [{ date: this.opts.archive ? null : (date || null), amount: received, ...(this.opts.archive ? { imported: true } : {}) }] : [],
        date: date || `${this.opts.month}-01`, dateUnknown: !date,
        done: this.map.done === undefined ? true : (doneV === "" ? true : toBool(doneV)),
        deadline: dl, note: String(get(r, "note") ?? "").trim(), remind: !!dl,
        ...(this.opts.archive ? { imported: true } : {}),
      });
    }
    return out;
  },

  render() {
    const cols = this.cols(), list = this.build();
    const sum = list.reduce((s, o) => s + o.price, 0);
    const m = openModal(`
      <div class="sheet-head"><h3>${icon("upload")} Импорт: ${esc(this.file)}</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
      ${this.wb.SheetNames.length > 1 ? `<label class="imp-l">Лист<select class="field" id="iSheet">${this.wb.SheetNames.map(n => `<option ${n === this.sheet ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>` : ""}
      <label class="imp-l">Строка с заголовками<input class="field" id="iHead" type="number" min="1" value="${this.head + 1}"></label>
      <div class="imp-map">${IMPORT_FIELDS.map(([k, l]) => `<label>${l}<select class="field" data-map="${k}"><option value="">— нет —</option>${cols.map(c => `<option value="${c.i}" ${this.map[k] === c.i ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>`).join("")}</div>
      <div class="imp-opts">
        ${this.map.debt !== undefined ? `<div class="set-row"><div class="sr-l"><div>«Цена» — это полная стоимость</div><div>Выключено: цена = уже полученные деньги, а долг добавляется сверху (как в таблице с колонками «Прайс» и «Долг»)</div></div><button class="toggle ${this.opts.priceIsAssigned ? "on" : ""}" data-o="priceIsAssigned"></button></div>` : ""}
        ${this.map.received === undefined && this.map.debt === undefined && this.map.paid === undefined ? `<div class="set-row"><div class="sr-l"><div>Все заказы уже оплачены</div><div>Нет столбцов «Получено», «Долг» или «Оплачен»</div></div><button class="toggle ${this.opts.allPaid ? "on" : ""}" data-o="allPaid"></button></div>` : ""}
        ${this.map.date === undefined ? `<div class="set-row"><div class="sr-l"><div>Месяц для заказов</div><div>В таблице нет столбца с датой — заказы получат плашку «не указано»</div></div><input class="field" type="month" id="iMonth" value="${this.opts.month}"></div>` : ""}
        <div class="set-row"><div class="sr-l"><div>Архив — без опыта и достижений</div><div>Деньги будут видны в учёте, но персонаж за них не прокачается</div></div><button class="toggle ${this.opts.archive ? "on" : ""}" data-o="archive"></button></div>
      </div>
      <div class="imp-prev"><b>Предпросмотр</b><span class="muted"> · ${list.length} ${plural(list.length, "заказ", "заказа", "заказов")} на ${money(sum)}</span>
        <div class="table-scroll"><table class="simple"><thead><tr><th>Дата</th><th>Клиент</th><th>Услуга</th><th class="r">Цена</th><th class="r">Получено</th><th>Готов</th></tr></thead>
        <tbody>${list.slice(0, 8).map(o => `<tr><td>${o.dateUnknown ? "не указано" : shortDate(o.date, true)}</td><td>${esc(o.client)}</td><td>${esc(o.service)}</td><td class="r">${money(o.price)}</td><td class="r">${money(o.payments.reduce((s, p) => s + p.amount, 0))}</td><td>${o.done ? "✓" : ""}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="m-actions"><button class="btn" data-x>Отмена</button><button class="btn primary" id="iGo" ${list.length ? "" : "disabled"}>${icon("download")} Импортировать ${list.length}</button></div>`, "sheet");
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = closeModal);
    m.querySelector("#iSheet")?.addEventListener("change", e => this.pickSheet(e.target.value));
    m.querySelector("#iHead").onchange = e => { this.head = Math.max(0, (parseInt(e.target.value) || 1) - 1); this.render(); };
    m.querySelectorAll("[data-map]").forEach(sel => sel.onchange = () => { if (sel.value === "") delete this.map[sel.dataset.map]; else this.map[sel.dataset.map] = +sel.value; this.render(); });
    m.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { this.opts[b.dataset.o] = !this.opts[b.dataset.o]; this.render(); });
    m.querySelector("#iMonth")?.addEventListener("change", e => { this.opts.month = e.target.value || this.opts.month; this.render(); });
    m.querySelector("#iGo").onclick = () => {
      const orders = list.map((o, i) => normalizeOrder({ ...o, createdAt: Date.now() + i }));
      Store.state.orders.push(...orders);
      Store.commit("orders");
      closeModal();
      const last = orders.map(o => o.date).sort().pop();
      toast("Импорт завершён", `${orders.length} ${plural(orders.length, "заказ", "заказа", "заказов")} на ${money(sum)}`, "ok", "download");
      if (last) { OrdersView.month = monthKey(last); }
      showTab("orders");
    };
  },
};

function colLetter(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function toMoney(v) { return typeof v === "number" ? Math.max(0, Math.round(v)) : parseMoney(v || ""); }
function toBool(v) { if (typeof v === "boolean") return v; if (typeof v === "number") return v !== 0; return /^(да|yes|true|\+|✓|✔|x|х|1|готов|сдан|выполн|оплачен)/i.test(String(v).trim()); }
function toDate(v) {
  if (!v && v !== 0) return null;
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === "number" && v > 20000 && v < 80000) return toISO(new Date(Math.round((v - 25569) * 86400000) + new Date().getTimezoneOffset() * 60000));
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : String(new Date().getFullYear()); return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  return null;
}
