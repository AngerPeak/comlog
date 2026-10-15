/* Напоминания о дедлайнах.
   • В приложении: колокольчик и всплывающие подсказки при открытии.
   • Windows: уведомления заранее ставятся в расписание системы — придут даже при закрытом COMLOG.
   • iPhone: экспорт в Календарь (.ics) с будильниками — их показывает сама iOS. */
function activeReminders() {
  const t = todayISO(), rd = Store.settings.remindDays;
  return Store.orders.filter(o => o.remind && !o.done && o.deadline && daysBetween(t, o.deadline) <= rd)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

/** Долги: работа сдана, а оплаты нет дольше N дней (настройка). Группируем по клиенту. */
function debtReminders(all = false) {
  if (!feat("debts")) return [];
  const t = todayISO(), N = Store.settings.debtDays || 14, m = new Map();
  for (const o of Store.orders) {
    if (!o.done || debtOf(o) <= 0) continue;
    const since = o.doneDate || (o.dateUnknown ? monthEnd(monthKey(o.date)) : o.date);
    const c = o.client.trim() || "Без имени";
    const x = m.get(c) || { client: c, sum: 0, count: 0, oldest: since };
    x.sum += debtOf(o); x.count++;
    if (since < x.oldest) x.oldest = since;
    m.set(c, x);
  }
  for (const x of m.values()) { x.age = daysBetween(x.oldest, t); x.due = addDays(x.oldest, N); }
  return [...m.values()].filter(x => all || x.age >= N).sort((a, b) => b.sum - a.sum);
}
function debtText(x) { return `${money(x.sum)} · ${x.count} ${plural(x.count, "работа", "работы", "работ")} · ждёт ${x.age} ${plural(x.age, "день", "дня", "дней")}`; }

function reminderText(o) {
  const d = daysBetween(todayISO(), o.deadline);
  return d < 0 ? `просрочен на ${-d} ${plural(-d, "день", "дня", "дней")}` : d === 0 ? "сдать сегодня" : d === 1 ? "сдать завтра" : `осталось ${d} ${plural(d, "день", "дня", "дней")}`;
}

function renderBell() {
  const list = activeReminders(), debts = debtReminders();
  $("#bellDot").hidden = !list.length && !debts.length;
  $("#bellPop").innerHTML = `<h4>Сроки</h4>` + (list.length ? list.map(o => `
    <div class="bell-item" data-go="${o.id}"><span class="date-chip">${shortDate(o.deadline)}</span>
      <div class="bi-main"><div class="bi-title">${esc(o.client || "Без имени")} · ${esc(o.service || "—")}</div><div class="bi-sub">${reminderText(o)}${o.deadlineTime ? ` до ${o.deadlineTime}` : ""}</div></div>${deadlineBadge(o)}</div>`).join("")
    : `<div class="bell-empty">Горящих сроков нет 👌</div>`)
    + (debts.length ? `<h4 style="margin-top:12px">Долги</h4>` + debts.map(x => `
    <div class="bell-item" data-debt="${esc(x.client)}"><span class="date-chip red-chip">${icon("coin")}</span>
      <div class="bi-main"><div class="bi-title">${esc(x.client)}</div><div class="bi-sub">${debtText(x)}</div></div></div>`).join("") : "");
  $$("#bellPop [data-go]").forEach(el => el.onclick = () => { $("#bellPop").hidden = true; OrdersView.goTo(el.dataset.go); });
  $$("#bellPop [data-debt]").forEach(el => el.onclick = () => {
    $("#bellPop").hidden = true;
    if (feat("estimates")) { EstimatesView.onlyUnpaid = true; EstimatesView.preset = "custom"; EstimatesView.from = debtReminders(true).find(x => x.client === el.dataset.debt)?.oldest || ""; EstimatesView.to = todayISO(); EstimatesView.month = monthKey(todayISO()); EstimatesView.openFor(el.dataset.debt); }
    else ClientsView.open(el.dataset.debt);
  });
}

/** При открытии приложения: подсказки внутри окна, не чаще раза в день на заказ. */
function checkReminders() {
  const t = todayISO(), g = Store.game;
  const fresh = activeReminders().filter(o => g.notified[o.id] !== t);
  renderBell();
  if (!fresh.length) return;
  fresh.forEach(o => g.notified[o.id] = t);
  const ids = new Set(Store.orders.map(o => o.id));
  Object.keys(g.notified).forEach(id => { if (!ids.has(id)) delete g.notified[id]; });
  Store.save();
  fresh.slice(0, 3).forEach(o => toast(`${o.client || "Без имени"}: ${reminderText(o)}`, o.service || "", "warn", "bell"));
  if (fresh.length > 3) toast(`И ещё ${fresh.length - 3} ${plural(fresh.length - 3, "срок", "срока", "сроков")}`, "Список — под колокольчиком", "warn", "bell");
}

/** Долги — раз в день на клиента: подсказка в приложении и (на ПК) уведомление Windows. */
function checkDebtReminders() {
  const t = todayISO(), g = Store.game;
  const fresh = debtReminders().filter(x => g.notified["debt:" + x.client] !== t);
  if (!fresh.length) return;
  fresh.forEach(x => g.notified["debt:" + x.client] = t);
  Store.save();
  fresh.slice(0, 3).forEach(x => toast(`${x.client} должен ${money(x.sum)}`, debtText(x), "warn", "coin"));
  const api = Store.api();
  if (api && Store.settings.winReminders) api.notify(fresh.length === 1 ? `COMLOG: ${fresh[0].client} должен ${money(fresh[0].sum)}` : `COMLOG: долги у ${fresh.length} клиентов`,
    fresh.slice(0, 4).map(x => `${x.client} — ${debtText(x)}`).join("\n"));
}

/** Моменты уведомлений: за день до дедлайна в выбранные часы. */
function reminderSlots(o) {
  const s = Store.settings, day = addDays(o.deadline, -1);
  return s.reminderTimes.slice(0, s.reminderCount).filter(Boolean).map(t => `${day}T${t}`);
}

let lastSchedule = null;
function scheduleWindowsReminders() {
  const api = Store.api();
  if (!api || !api.schedule_reminders) return;
  const now = new Date(), items = [];
  if (Store.settings.winReminders) {
    for (const o of Store.orders) {
      if (!o.remind || o.done || !o.deadline) continue;
      for (const at of reminderSlots(o)) {
        if (new Date(at) <= now) continue;
        items.push({
          at, title: `Завтра дедлайн: ${o.client || "заказ"}`,
          body: `${o.service || "Без названия"} — сдать ${longDate(o.deadline)}${o.price ? ` · ${money(o.price)}` : ""}`,
        });
      }
    }
  }
  if (Store.settings.winReminders) for (const x of debtReminders(true)) {
    if (x.age >= (Store.settings.debtDays || 14)) continue;
    items.push({ at: `${x.due}T12:00`, title: `${x.client} пока не оплатил работу`, body: `${money(x.sum)} · ${x.count} ${plural(x.count, "работа", "работы", "работ")} ждут оплаты уже ${Store.settings.debtDays} дней` });
  }
  items.sort((a, b) => a.at.localeCompare(b.at));
  const json = JSON.stringify(items.slice(0, 120));
  if (json === lastSchedule) return;
  lastSchedule = json;
  api.schedule_reminders(json).catch(e => console.error(e));
}

/* ---------- Календарь (.ics) ---------- */
function icsEscape(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
function buildICS(orders) {
  const s = Store.settings;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//COMLOG//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const o of orders) {
    const d = o.deadline.replace(/-/g, ""), next = addDays(o.deadline, 1).replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:comlog-${o.id}@comlog`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEscape(`Дедлайн: ${o.client || "заказ"} — ${o.service || "без названия"}`)}`,
      `DESCRIPTION:${icsEscape(`COMLOG${o.price ? ` · ${money(o.price)}` : ""}`)}`);
    // от полуночи дня дедлайна: 10:00 накануне = −14 часов
    for (const t of s.reminderTimes.slice(0, s.reminderCount).filter(Boolean)) {
      const [h, m] = t.split(":").map(Number), mins = 24 * 60 - (h * 60 + m);
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(`Завтра дедлайн: ${o.client || "заказ"}`)}`, `TRIGGER:-PT${Math.floor(mins / 60)}H${mins % 60 ? (mins % 60) + "M" : ""}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
async function exportICS(orders = null, name = "comlog-deadlines.ics") {
  const t = todayISO();
  orders = orders || Store.orders.filter(o => o.deadline && !o.done && o.remind && o.deadline >= t);
  if (!orders.length) return toast("Нет будущих дедлайнов", "Экспортировать нечего", "warn", "cal");
  const path = await saveFile(name, buildICS(orders), "text/calendar");
  if (path) toast(`В календарь: ${orders.length} ${plural(orders.length, "дедлайн", "дедлайна", "дедлайнов")}`, "Откройте файл и нажмите «Добавить все»", "ok", "cal");
}
