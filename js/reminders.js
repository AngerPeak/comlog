/* Напоминания о дедлайнах.
   • В приложении: колокольчик и всплывающие подсказки при открытии.
   • Windows: уведомления заранее ставятся в расписание системы — придут даже при закрытом COMLOG.
   • iPhone: экспорт в Календарь (.ics) с будильниками — их показывает сама iOS. */
function activeReminders() {
  const t = todayISO(), rd = Store.settings.remindDays;
  return Store.orders.filter(o => o.remind && !o.done && o.deadline && daysBetween(t, o.deadline) <= rd)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

function reminderText(o) {
  const d = daysBetween(todayISO(), o.deadline);
  return d < 0 ? `просрочен на ${-d} ${plural(-d, "день", "дня", "дней")}` : d === 0 ? "сдать сегодня" : d === 1 ? "сдать завтра" : `осталось ${d} ${plural(d, "день", "дня", "дней")}`;
}

function renderBell() {
  const list = activeReminders();
  $("#bellDot").hidden = !list.length;
  $("#bellPop").innerHTML = `<h4>Напоминания</h4>` + (list.length ? list.map(o => `
    <div class="bell-item" data-go="${o.id}"><span class="date-chip">${shortDate(o.deadline)}</span>
      <div class="bi-main"><div class="bi-title">${esc(o.client || "Без имени")} · ${esc(o.service || "—")}</div><div class="bi-sub">${reminderText(o)}</div></div>${deadlineBadge(o)}</div>`).join("")
    : `<div class="bell-empty">Горящих сроков нет 👌</div>`);
  $$("#bellPop [data-go]").forEach(el => el.onclick = () => { $("#bellPop").hidden = true; OrdersView.goTo(el.dataset.go); });
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
