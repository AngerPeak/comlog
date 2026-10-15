/* Экспорт в Excel (.xlsx) с оформлением:
   • «Сводка» — карточки итогов, таблица по месяцам с полосами, топ клиентов и услуг, итоги по годам;
   • лист на каждый год — окна месяцев: шапка, таблица заказов, итоговая строка и карточки-счётчики справа;
   • «Все заказы» — плоская таблица с фильтрами для своих расчётов. */
const XL = {
  ink: "FF141414", ink2: "FF3B3B3B", muted: "FF8A8A84", line: "FFDEDED8", zebra: "FFF7F7F4", card: "FFF2F2EE",
  dark: "FF0E0E0E", green: "FF2E8B3E", red: "FFD64545", white: "FFFFFFFF",
  font: "Segoe UI",
};
const MONEY = '#,##0 "₽"';

function xlArgb(hex) { return "FF" + hex.replace("#", "").toUpperCase(); }

const ExcelExport = {
  open() {
    const years = [...new Set(Store.orders.map(o => o.date.slice(0, 4)))].sort().reverse();
    if (!years.length) return toast("Нечего выгружать", "Заказов пока нет", "warn", "table");
    const m = openModal(`<div class="sheet-head"><h3>${icon("table")} Экспорт в Excel</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
      <p>Оформленная таблица: сводка, окна заказов по месяцам со счётчиками и лист со всеми заказами для фильтров.</p>
      <div class="est-l">Период</div>
      <div class="seg full" id="xlYears"><button data-y="all" class="on">Всё время</button>${years.slice(0, 4).map(y => `<button data-y="${y}">${y}</button>`).join("")}</div>
      <div class="set-row" style="margin-top:8px"><div class="sr-l"><div>Лист «Все заказы»</div><div>Одна таблица с фильтрами — удобно считать самому</div></div><button class="toggle on" id="xlFlat"></button></div>
      <div class="m-actions"><button class="btn ghost" id="xlCsv">${icon("table")} Простой CSV</button><div class="spacer"></div><button class="btn primary" id="xlGo">${icon("download")} Скачать .xlsx</button></div>`, "wide");
    let year = "all", flat = true;
    m.querySelector("[data-x]").onclick = closeModal;
    m.querySelectorAll("[data-y]").forEach(b => b.onclick = () => { year = b.dataset.y; m.querySelectorAll("[data-y]").forEach(x => x.classList.toggle("on", x === b)); });
    m.querySelector("#xlFlat").onclick = e => { flat = !flat; e.currentTarget.classList.toggle("on", flat); };
    m.querySelector("#xlCsv").onclick = () => { closeModal(); exportCSV(); };
    m.querySelector("#xlGo").onclick = async e => {
      const b = e.currentTarget; b.disabled = true; b.innerHTML = `${icon("download")} Готовлю…`;
      try {
        await loadScript("vendor/exceljs.min.js");
        const blob = await this.build(year, flat);
        closeModal();
        const path = await saveBlob(`COMLOG-${year === "all" ? "всё-время" : year}-${todayISO()}.xlsx`, blob);
        if (path) toast("Excel сохранён", typeof path === "string" ? path : "", "ok", "table");
      } catch (err) {
        console.error(err);
        toast("Не удалось собрать Excel", err.message || String(err), "err", "x");
        b.disabled = false; b.innerHTML = `${icon("download")} Скачать .xlsx`;
      }
    };
  },

  orders(year) {
    return Store.orders.filter(o => year === "all" || o.date.startsWith(year))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.dateUnknown - b.dateUnknown) || b.createdAt - a.createdAt);
  },

  async build(year, flat) {
    const wb = new ExcelJS.Workbook();
    wb.creator = "COMLOG"; wb.created = new Date();
    const list = this.orders(year);
    const accent = xlArgb(Store.settings.accent || "#c2f02f");
    const accentInk = inkFor(Store.settings.accent || "#c2f02f") === "#ffffff" ? XL.white : XL.ink;
    const pale = "FF" + hexToRgb(Store.settings.accent || "#c2f02f").map(v => Math.round(v + (255 - v) * .62).toString(16).padStart(2, "0")).join("").toUpperCase();
    const ctx = { wb, list, accent, accentInk, pale };
    this.summary(ctx, year);
    const years = [...new Set(list.map(o => o.date.slice(0, 4)))].sort().reverse();
    for (const y of years) this.yearSheet(ctx, y);
    if (flat) this.flatSheet(ctx);
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  },

  /* ----- общие помощники оформления ----- */
  style(cell, o = {}) {
    cell.font = { name: XL.font, size: o.size || 10, bold: !!o.bold, italic: !!o.italic, color: { argb: o.color || XL.ink } };
    if (o.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
    cell.alignment = { vertical: "middle", horizontal: o.align || "left", indent: o.indent ?? (o.align === "right" || o.align === "center" ? 0 : 1), wrapText: !!o.wrap };
    if (o.fmt) cell.numFmt = o.fmt;
    if (o.border) cell.border = o.border;
  },
  box(color = XL.line) { const s = { style: "thin", color: { argb: color } }; return { top: s, bottom: s, left: s, right: s }; },
  band(ws, row, from, to, text, o) {
    ws.mergeCells(row, from, row, to);
    const c = ws.getCell(row, from);
    c.value = text;
    this.style(c, o);
    for (let col = from; col <= to; col++) if (o.fill) ws.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.fill } };
    ws.getRow(row).height = o.height || 22;
  },
  /** Карточка-счётчик: подпись и крупное значение, слева — цветная полоса. */
  card(ws, row, col, span, label, value, o = {}) {
    const to = col + span - 1, edge = { style: "thick", color: { argb: o.edge || o.accent } };
    if (span > 1) { ws.mergeCells(row, col, row, to); ws.mergeCells(row + 1, col, row + 1, to); }
    const l = ws.getCell(row, col), v = ws.getCell(row + 1, col);
    l.value = label; v.value = value;
    this.style(l, { size: 9, color: XL.muted, fill: XL.card });
    this.style(v, { size: o.size || 16, bold: true, color: o.color || XL.ink, fill: XL.card, fmt: o.fmt });
    for (let c = col; c <= to; c++) for (const r of [row, row + 1]) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: XL.card } };
    l.border = { left: edge, top: { style: "thin", color: { argb: XL.card } } };
    v.border = { left: edge, bottom: { style: "thin", color: { argb: XL.card } } };
    if (!o.keepRows) {
      ws.getRow(row).height = Math.max(ws.getRow(row).height || 15, 17);
      ws.getRow(row + 1).height = Math.max(ws.getRow(row + 1).height || 15, 26);
    }
  },
  titleBlock(ws, ctx, title, sub, toCol) {
    this.band(ws, 1, 2, toCol, title, { size: 20, bold: true, color: ctx.accent, fill: XL.dark, height: 40 });
    this.band(ws, 2, 2, toCol, sub, { size: 10, color: "FFBDBDB6", fill: XL.dark, height: 20 });
    ws.getRow(3).height = 10;
  },
  monthStats(orders) {
    const s = { count: orders.length, done: 0, price: 0, received: 0, debt: 0, payers: 0 };
    for (const o of orders) { s.price += o.price; s.received += o.received; s.debt += debtOf(o); if (o.done) s.done++; if (o.received > 0) s.payers++; }
    s.avg = s.payers ? Math.round(s.received / s.payers) : 0;
    return s;
  },
  byMonth(orders) {
    const m = new Map();
    for (const o of orders) { const k = monthKey(o.date); if (!m.has(k)) m.set(k, []); m.get(k).push(o); }
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  },
  monthName(k) { const t = monthTitle(k); return t[0].toUpperCase() + t.slice(1); },

  /* ----- лист «Сводка» ----- */
  summary(ctx, year) {
    const ws = ctx.wb.addWorksheet("Сводка", { views: [{ showGridLines: false }], properties: { tabColor: { argb: ctx.accent } } });
    ws.columns = [{ width: 2 }, { width: 18 }, { width: 11 }, { width: 12 }, { width: 15 }, { width: 13 }, { width: 14 }, { width: 3 }, { width: 24 }, { width: 10 }, { width: 15 }];
    const all = this.monthStats(ctx.list);
    const clients = new Set(ctx.list.map(o => o.client.trim()).filter(Boolean));
    this.titleBlock(ws, ctx, `COMLOG · ${year === "all" ? "вся история" : year + " год"}`,
      `Выгружено ${longDate(todayISO())} · ${all.count} ${plural(all.count, "заказ", "заказа", "заказов")} · ${clients.size} ${plural(clients.size, "клиент", "клиента", "клиентов")}`, 11);
    // карточки
    const cards = [["Заработано", all.received, { color: XL.green, fmt: MONEY }], ["Заказов", all.count, {}], ["Долг сейчас", all.debt, { color: all.debt ? XL.red : XL.ink, fmt: MONEY, edge: XL.red }], ["Средний чек", all.avg, { fmt: MONEY }]];
    const pos = [[2, 2], [4, 3], [7, 2], [9, 3]];
    cards.forEach(([l, v, o], i) => this.card(ws, 4, pos[i][0], pos[i][1], l, v, { accent: ctx.accent, ...o }));
    // таблица по месяцам
    let r = 7;
    this.band(ws, r, 2, 7, "По месяцам", { size: 12, bold: true, color: ctx.accentInk, fill: ctx.accent, height: 24 });
    r++;
    const head = ["Месяц", "Заказов", "Выполнено", "Получено", "Долг", "Средний чек"];
    head.forEach((h, i) => this.style(Object.assign(ws.getCell(r, 2 + i), { value: h }), { bold: true, size: 9, color: XL.white, fill: "FF262626", align: i ? "right" : "left", border: this.box("FF262626") }));
    ws.getRow(r).height = 20;
    const first = r + 1;
    this.byMonth(ctx.list).forEach(([k, orders], i) => {
      r++;
      const s = this.monthStats(orders), z = i % 2 ? XL.zebra : XL.white;
      const vals = [this.monthName(k), s.count, s.done, s.received, s.debt, s.avg];
      ws.getRow(r).height = 20;
      vals.forEach((v, j) => this.style(Object.assign(ws.getCell(r, 2 + j), { value: v }), {
        fill: z, align: j ? "right" : "left", fmt: j >= 3 ? MONEY : undefined, border: this.box(),
        color: j === 4 && v ? XL.red : j === 3 ? XL.green : XL.ink, bold: j === 3,
      }));
    });
    const last = r;
    r++;
    ["Итого", `=SUM(C${first}:C${last})`, `=SUM(D${first}:D${last})`, `=SUM(E${first}:E${last})`, `=SUM(F${first}:F${last})`, ""].forEach((v, j) => {
      const c = ws.getCell(r, 2 + j);
      c.value = typeof v === "string" && v.startsWith("=") ? { formula: v.slice(1) } : v;
      this.style(c, { bold: true, fill: "FFE8E8E3", align: j ? "right" : "left", fmt: j >= 3 ? MONEY : undefined, border: { top: { style: "medium", color: { argb: XL.ink } }, bottom: { style: "thin", color: { argb: XL.line } } } });
    });
    try {
      ws.addConditionalFormatting({ ref: `E${first}:E${last}`, rules: [{ type: "dataBar", minLength: 0, maxLength: 100, gradient: false, cfvo: [{ type: "min" }, { type: "max" }], color: { argb: ctx.pale } }] });
    } catch (e) { console.warn(e); }
    // справа: топ клиентов и услуг, итоги по годам
    let rr = 7;
    const side = (title, rows, cols) => {
      this.band(ws, rr, 9, 11, title, { size: 11, bold: true, color: ctx.accentInk, fill: ctx.accent, height: ws.getRow(rr).height || 20 });
      rr++;
      cols.forEach((h, i) => this.style(Object.assign(ws.getCell(rr, 9 + i), { value: h }), { bold: true, size: 9, color: XL.white, fill: "FF262626", align: i ? "right" : "left", border: this.box("FF262626") }));
      rows.forEach((row, i) => { rr++; if (!ws.getRow(rr).height) ws.getRow(rr).height = 20; row.forEach((v, j) => this.style(Object.assign(ws.getCell(rr, 9 + j), { value: v }), { fill: i % 2 ? XL.zebra : XL.white, align: j ? "right" : "left", fmt: j === 2 ? MONEY : undefined, border: this.box(), bold: j === 2 })); });
      rr += 2;
    };
    const agg = key => {
      const m = new Map();
      for (const o of ctx.list) { const k = o[key].trim() || "Без названия"; const x = m.get(k) || [k, 0, 0]; x[1]++; x[2] += o.received; m.set(k, x); }
      return [...m.values()].sort((a, b) => b[2] - a[2]).slice(0, 10);
    };
    side("Топ клиентов", agg("client"), ["Клиент", "Заказов", "Получено"]);
    side("Топ услуг", agg("service"), ["Услуга", "Заказов", "Получено"]);
    const years = [...new Set(ctx.list.map(o => o.date.slice(0, 4)))].sort().reverse();
    if (years.length > 1) side("По годам", years.map(y => { const s = this.monthStats(ctx.list.filter(o => o.date.startsWith(y))); return [y, s.count, s.received]; }), ["Год", "Заказов", "Получено"]);
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2 } };
  },

  /* ----- лист года: окна месяцев со счётчиками ----- */
  yearSheet(ctx, y) {
    const ws = ctx.wb.addWorksheet(y, { views: [{ showGridLines: false }], properties: { tabColor: { argb: "FF262626" } } });
    ws.columns = [{ width: 2 }, { width: 12 }, { width: 22 }, { width: 30 }, { width: 13 }, { width: 13 }, { width: 12 }, { width: 11 }, { width: 10 }, { width: 13 }, { width: 3 }, { width: 17 }, { width: 17 }];
    const orders = ctx.list.filter(o => o.date.startsWith(y));
    const ys = this.monthStats(orders);
    this.titleBlock(ws, ctx, `${y} год`, `${ys.count} ${plural(ys.count, "заказ", "заказа", "заказов")} · заработано ${money(ys.received)}${ys.debt ? ` · долг ${money(ys.debt)}` : ""}`, 13);
    let r = 4;
    const head = ["Дата", "Клиент", "Услуга", "Прайс", "Получено", "Долг", "Выполнен", "Оплачен", "Дедлайн"];
    const tax = Store.settings.taxEnabled ? Store.settings.taxRate : 0;
    for (const [k, list] of this.byMonth(orders)) {
      const s = this.monthStats(list);
      // шапка окна месяца
      this.band(ws, r, 2, 10, this.monthName(k), { size: 13, bold: true, color: ctx.accentInk, fill: ctx.accent, height: 26 });
      this.band(ws, r, 12, 13, "Итоги месяца", { size: 10, bold: true, color: ctx.accent, fill: XL.dark, height: 26, align: "center" });
      const top = r + 1;
      r++;
      head.forEach((h, i) => this.style(Object.assign(ws.getCell(r, 2 + i), { value: h }), { bold: true, size: 9, color: XL.white, fill: "FF262626", align: i >= 3 && i <= 5 ? "right" : i >= 6 && i <= 7 ? "center" : "left", border: this.box("FF262626") }));
      ws.getRow(r).height = 20;
      const first = r + 1;
      list.forEach((o, i) => {
        r++;
        const z = i % 2 ? XL.zebra : XL.white, b = this.box();
        const cell = (col, v, o2 = {}) => { const c = ws.getCell(r, col); c.value = v; this.style(c, { fill: z, border: b, ...o2 }); return c; };
        if (o.dateUnknown) cell(2, "не указано", { italic: true, color: XL.muted, size: 9 });
        else cell(2, xlDate(o.date), { fmt: "dd.mm.yyyy" });
        cell(3, o.client || "—", { bold: true });
        cell(4, o.service || "—", { color: XL.ink2 });
        cell(5, o.price, { fmt: MONEY, align: "right" });
        cell(6, o.received, { fmt: MONEY, align: "right", color: o.received ? XL.green : XL.muted, bold: !!o.received });
        cell(7, debtOf(o), { fmt: MONEY, align: "right", color: debtOf(o) ? XL.red : XL.muted, bold: !!debtOf(o) });
        cell(8, o.done ? "✓" : "—", { align: "center", bold: o.done, color: o.done ? XL.green : XL.muted, size: 11 });
        cell(9, o.paid ? "✓" : "—", { align: "center", bold: o.paid, color: o.paid ? XL.green : XL.red, size: 11 });
        if (o.deadline) cell(10, xlDate(o.deadline), { fmt: "dd.mm.yyyy" }); else cell(10, "", {});
        ws.getRow(r).height = 20;
      });
      const last = r;
      r++;
      const sumRow = r, tb = { top: { style: "medium", color: { argb: XL.ink } }, bottom: { style: "thin", color: { argb: XL.line } } };
      ["Итого", `${s.count} ${plural(s.count, "заказ", "заказа", "заказов")}`, "", { formula: `SUM(E${first}:E${last})` }, { formula: `SUM(F${first}:F${last})` }, { formula: `SUM(G${first}:G${last})` },
        `${s.done}/${s.count}`, `${list.filter(o => o.paid).length}/${s.count}`, ""].forEach((v, j) => {
        const c = ws.getCell(sumRow, 2 + j);
        c.value = v;
        this.style(c, { bold: true, fill: "FFE8E8E3", border: tb, fmt: j >= 3 && j <= 5 ? MONEY : undefined, align: j >= 3 && j <= 5 ? "right" : j >= 6 && j <= 7 ? "center" : "left", color: j === 4 ? XL.green : j === 5 && s.debt ? XL.red : XL.ink });
      });
      ws.getRow(sumRow).height = 22;
      // карточки-счётчики справа от таблицы
      const cards = [
        ["Заработано", { formula: `F${sumRow}` }, { color: XL.green, fmt: MONEY }],
        ["Заказов", s.count, {}],
        ["Долг", { formula: `G${sumRow}` }, { color: s.debt ? XL.red : XL.ink, fmt: MONEY, edge: s.debt ? XL.red : ctx.accent }],
        ["Выполнено", `${s.done} из ${s.count}`, {}],
        ["Средний чек", s.avg, { fmt: MONEY }],
        ...(tax ? [[`Налог ${tax}%`, Math.round(s.received * tax / 100), { fmt: MONEY }]] : []),
      ];
      // карточки сеткой 2 × N справа от таблицы
      let cr = top;
      cards.forEach(([l, v, o], i) => {
        const row = top + Math.floor(i / 2) * 3, col = 12 + (i % 2);
        this.card(ws, row, col, 1, l, v, { accent: ctx.accent, size: 13, keepRows: true, ...o });
        for (const x of [row, row + 1, row + 2]) if (x > r) ws.getRow(x).height = 20;   // строки ниже таблицы — той же высоты
        cr = Math.max(cr, row + 3);
      });
      r = Math.max(r, cr - 1) + 2;
    }
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2 } };
  },

  /* ----- лист «Все заказы» ----- */
  flatSheet(ctx) {
    const ws = ctx.wb.addWorksheet("Все заказы", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }], properties: { tabColor: { argb: "FF8A8A84" } } });
    const cols = [["Дата", 12], ["Месяц", 15], ["Клиент", 22], ["Услуга", 28], ["Прайс", 12], ["Получено", 12], ["Долг", 11], ["Выполнен", 12], ["Оплачен", 11], ["Дедлайн", 12], ["Время, ч", 11], ["Заметка", 32], ["Ссылка", 26]];
    ws.columns = cols.map(([h, w]) => ({ header: h, width: w }));
    ws.getRow(1).eachCell(c => this.style(c, { bold: true, size: 9, color: XL.white, fill: "FF262626", border: this.box("FF262626") }));
    ws.getRow(1).height = 22;
    ctx.list.forEach((o, i) => {
      const row = ws.addRow([o.dateUnknown ? null : xlDate(o.date), this.monthName(monthKey(o.date)), o.client, o.service, o.price, o.received, debtOf(o),
        o.done ? "да" : "нет", o.paid ? "да" : "нет", o.deadline ? xlDate(o.deadline) : null, workMs(o) ? Math.round(workMs(o) / 360000) / 10 : null, o.note || "", o.link || ""]);
      const z = i % 2 ? XL.zebra : XL.white;
      row.eachCell({ includeEmpty: true }, (c, n) => this.style(c, {
        fill: z, border: this.box(), fmt: n === 1 || n === 10 ? "dd.mm.yyyy" : n >= 5 && n <= 7 ? MONEY : undefined,
        align: n >= 5 && n <= 7 || n === 11 ? "right" : n === 8 || n === 9 ? "center" : "left",
        color: n === 7 && debtOf(o) ? XL.red : n === 6 && o.received ? XL.green : XL.ink,
      }));
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  },
};

/** Дата без сдвига часового пояса (Excel хранит даты без зоны). */
function xlDate(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
