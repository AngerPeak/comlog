/* Общие помощники: даты, деньги, DOM, цвета, тосты, модалки. */
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_FULL = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function icon(id, cls = "") { return `<svg class="${cls}"><use href="#i-${id}"/></svg>`; }
const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

/* ----- даты: строка YYYY-MM-DD, локальное время ----- */
function pad(n) { return String(n).padStart(2, "0"); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function addMonths(iso, n) {
  const d = parseISO(iso); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return toISO(d);
}
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function monthKey(iso) { return iso.slice(0, 7); }
function monthStart(key) { return key + "-01"; }
function monthEnd(key) { const [y, m] = key.split("-").map(Number); return toISO(new Date(y, m, 0)); }
function shiftMonth(key, n) { return monthKey(addMonths(monthStart(key), n)); }
function monthsBetween(a, b) { const [y1, m1] = a.split("-").map(Number), [y2, m2] = b.split("-").map(Number); return (y2 - y1) * 12 + (m2 - m1); }
function weekStart(iso) { const d = parseISO(iso); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toISO(d); }

/** Сжатая дата: «окт.14» (год добавляется, если не текущий и попросили). */
function shortDate(iso, withYear = false) {
  if (!iso) return "";
  const d = parseISO(iso);
  const y = withYear && d.getFullYear() !== new Date().getFullYear() ? ` ’${String(d.getFullYear()).slice(2)}` : "";
  return `${MONTHS_SHORT[d.getMonth()]}.${d.getDate()}${y}`;
}
function longDate(iso) { const d = parseISO(iso); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; }
function monthTitle(key) { const [y, m] = key.split("-").map(Number); return `${MONTHS_FULL[m - 1]} ${y}`; }
function monthShortTitle(key) { const [y, m] = key.split("-").map(Number); return `${MONTHS_SHORT[m - 1]} ${y}`; }
/** Дата заказа для показа: у архивных заказов без дня — «не указано». */
function orderDateLabel(o, withYear = false) { return o.dateUnknown ? "не указано" : shortDate(o.date, withYear); }

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ----- деньги ----- */
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
function fmt(n) { return nf.format(Math.round(n || 0)); }
function money(n) { return `${fmt(n)} ₽`; }
function compactMoney(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " млн";
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(".", ",").replace(",0", "") + " т";
  return fmt(n);
}
function parseMoney(s) {
  const v = parseFloat(String(s).replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}
function pct(a, b) { return b ? Math.round(((a - b) / b) * 100) : null; }

/* ----- строки и цвета ----- */
const TRANSLIT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
function looseName(s) { return s.toLowerCase().split("").map(c => TRANSLIT[c] ?? c).join("").replace(/[^a-z0-9]/g, ""); }
function serviceKey(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return dp[b.length];
}

const PALETTE = ["#c2f02f", "#5ee0b5", "#6fb6ff", "#8f9cff", "#b48cff", "#ff8fb1", "#ff7a59", "#ffb547", "#ffd257", "#9aa0a6"];
function hexToRgb(h) { const m = h.replace("#", ""); const v = parseInt(m.length === 3 ? m.split("").map(c => c + c).join("") : m, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function luminance(h) { const [r, g, b] = hexToRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; }
function inkFor(h) { return luminance(h) > .36 ? "#0b0b0b" : "#ffffff"; }

const AVA_COLORS = ["#c2f02f", "#6fb6ff", "#b48cff", "#ffb547", "#5ee0b5", "#ff8fb1", "#ffd257", "#9be15d"];
function avaColor(name) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVA_COLORS[h % AVA_COLORS.length]; }
function initials(name) { const p = name.trim().split(/\s+/); return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase(); }

/* ----- тосты ----- */
function toast(title, msg = "", kind = "ok", ico = "check", action = null) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<div class="t-ico">${icon(ico)}</div><div class="t-body"><div class="t-title">${esc(title)}</div>${msg ? `<div class="t-msg">${esc(msg)}</div>` : ""}</div>
    ${action ? `<button class="btn sm t-act">${esc(action.label)}</button>` : ""}`;
  $("#toasts").appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 260); };
  if (action) el.querySelector(".t-act").onclick = () => { action.run(); close(); };
  setTimeout(close, action ? 7000 : kind === "warn" ? 6500 : 4200);
}

/* ----- модалки ----- */
function openModal(html, cls = "") {
  const body = $("#modalBody");
  body.className = "modal " + cls;
  body.innerHTML = html;
  $("#modal").hidden = false;
  return body;
}
let onModalClose = null;
function closeModal() {
  $("#modal").hidden = true; $("#modalBody").innerHTML = "";
  if (onModalClose) { const f = onModalClose; onModalClose = null; f(); }
}
function confirmBox(title, text, okLabel = "Подтвердить", danger = false) {
  return new Promise(resolve => {
    const m = openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p>
      <div class="m-actions"><button class="btn" data-r="0">Отмена</button><button class="btn ${danger ? "danger" : "primary"}" data-r="1">${esc(okLabel)}</button></div>`);
    m.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { closeModal(); resolve(b.dataset.r === "1"); });
  });
}
function promptBox(title, text, value = "", ac = "") {
  return new Promise(resolve => {
    const m = openModal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><input class="field" id="pbInput" value="${esc(value)}" ${ac ? `data-ac="${ac}"` : ""} autocomplete="off">
      <div class="m-actions"><button class="btn" data-r="0">Отмена</button><button class="btn primary" data-r="1">Сохранить</button></div>`);
    const inp = m.querySelector("#pbInput"); inp.focus(); inp.select();
    const done = ok => { const v = inp.value.trim(); closeModal(); resolve(ok ? v : null); };
    inp.onkeydown = e => { if (e.key === "Enter" && !AC.isOpen()) done(true); if (e.key === "Escape" && !AC.isOpen()) done(false); };
    m.querySelectorAll("[data-r]").forEach(b => b.onclick = () => done(b.dataset.r === "1"));
  });
}

/** Палитра цветов во всплывающем окне. Возвращает цвет, "" (без цвета) или null (отмена). */
function pickColor(anchor, current, allowNone = true) {
  return new Promise(resolve => {
    document.querySelector(".color-pop")?.remove();
    const pop = document.createElement("div");
    pop.className = "color-pop";
    pop.innerHTML = PALETTE.map(c => `<button class="sw ${c === current ? "on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")
      + `<label class="sw custom" title="Свой цвет"><input type="color" value="${current || "#c2f02f"}">${icon("edit")}</label>`
      + (allowNone ? `<button class="sw none" data-c="" title="Без цвета">${icon("x")}</button>` : "");
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - pop.offsetWidth - 8, Math.max(8, r.left)) + "px";
    pop.style.top = (r.bottom + pop.offsetHeight + 8 > window.innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + "px";
    const finish = v => { pop.remove(); document.removeEventListener("pointerdown", outside, true); resolve(v); };
    const outside = e => { if (!pop.contains(e.target)) finish(null); };
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
    pop.querySelectorAll("[data-c]").forEach(b => b.onclick = () => finish(b.dataset.c));
    pop.querySelector("input[type=color]").onchange = e => finish(e.target.value);
  });
}

/* ----- файлы ----- */
async function saveFile(name, text, mime = "application/json") {
  const api = Store.api();
  if (api) return api.save_file(name, text);
  const file = new File([text], name, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return name; }
    catch (e) { if (e.name === "AbortError") return null; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return name;
}
function pickTextFile(accept) {
  return new Promise(resolve => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = accept;
    inp.onchange = () => { const f = inp.files[0]; if (!f) return resolve(null); f.text().then(text => resolve({ text, name: f.name })); };
    inp.click();
  });
}
