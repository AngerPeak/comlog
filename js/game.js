/* Геймификация: опыт, уровни, материя, эволюция, достижения, магазин.

   Баланс рассчитан на доход ~60–80 тыс ₽/мес:
   • 10 ₽ полученных денег = 1 XP  → ~7 000 XP в месяц
   • 40 ₽ = 1 ◆ материи           → ~1 750 ◆ в месяц
   • ур. 10 ≈ 2 мес, ур. 25 ≈ 1 год, ур. 50 ≈ 4–5 лет.
   Всё, кроме покупок и открытых достижений, вычисляется из базы заказов,
   поэтому опыт нельзя «накрутить» повторным нажатием галочек. */
const ECON = {
  rubPerXP: 10,
  rubPerMatter: 40,
  onTimeXP: 40,
  goalXP: 1500,
  goalMatter: 300,
};

function xpForNext(level) { return Math.round((260 * Math.pow(level, 1.08) + 240) / 10) * 10; }

function levelFromXP(xp) {
  let level = 1, need = xpForNext(1), rest = xp;
  while (rest >= need) { rest -= need; level++; need = xpForNext(level); }
  return { level, into: rest, need };
}

const TITLES = [
  [1, "Новичок"], [5, "Стажёр"], [10, "Подмастерье"], [15, "Ремесленник"], [20, "Профи"], [25, "Эксперт"],
  [30, "Мастер"], [35, "Виртуоз"], [40, "Магнат"], [45, "Легенда"], [50, "Титан"], [60, "Бессмертный"],
];
function titleFor(level) { let t = TITLES[0][1]; for (const [l, n] of TITLES) if (level >= l) t = n; return t; }

const EVOLUTION = [
  { lvl: 1, name: "Искра", desc: "Начало пути" },
  { lvl: 10, name: "Росток", desc: "Пробивается листок" },
  { lvl: 20, name: "Носитель", desc: "Знак материи на груди" },
  { lvl: 35, name: "Орбита", desc: "Вокруг кружат частицы" },
  { lvl: 50, name: "Вознесение", desc: "Светящиеся глаза и сияние" },
];
function stageFor(level) { let s = 0; EVOLUTION.forEach((e, i) => { if (level >= e.lvl) s = i; }); return s; }

/* ---------- магазин ---------- */
const SLOTS = { skin: "Скин", head: "Головной убор", eyes: "Очки", neck: "Аксессуар", aura: "Аура", pet: "Питомец" };
const ITEMS = [
  ["skin_graphite", "skin", "Графит", 0, 1], ["skin_mint", "skin", "Мята", 600, 1], ["skin_peach", "skin", "Персик", 900, 3],
  ["skin_lavender", "skin", "Лаванда", 900, 3], ["skin_lime", "skin", "Лайм", 1600, 5], ["skin_night", "skin", "Полночь", 2800, 10],
  ["skin_gold", "skin", "Золото", 6500, 20], ["skin_holo", "skin", "Голограмма", 12000, 35],
  ["head_cap", "head", "Кепка COMLOG", 700, 1], ["head_beanie", "head", "Вязаная шапка", 900, 2], ["head_phones", "head", "Наушники", 1600, 6],
  ["head_horns", "head", "Рожки", 2200, 8], ["head_tophat", "head", "Цилиндр", 3000, 12], ["head_wizard", "head", "Шляпа мага", 3800, 15],
  ["head_crown", "head", "Корона", 8000, 25], ["head_halo", "head", "Нимб", 10000, 30],
  ["eyes_round", "eyes", "Круглые очки", 600, 1], ["eyes_shades", "eyes", "Тёмные очки", 1200, 4], ["eyes_monocle", "eyes", "Монокль", 2000, 9],
  ["eyes_visor", "eyes", "Кибер-визор", 4500, 18],
  ["neck_bow", "neck", "Бабочка", 500, 1], ["neck_scarf", "neck", "Шарф", 900, 3], ["neck_chain", "neck", "Золотая цепь", 3200, 12],
  ["neck_cape", "neck", "Плащ героя", 5000, 20],
  ["aura_ring", "aura", "Неоновое кольцо", 2000, 7], ["aura_stars", "aura", "Звёздная пыль", 3500, 14], ["aura_flame", "aura", "Пламя", 6000, 22],
  ["aura_aurora", "aura", "Северное сияние", 9000, 32],
  ["pet_slime", "pet", "Слаймик", 2500, 5], ["pet_cat", "pet", "Кот Байт", 4000, 10], ["pet_owl", "pet", "Совёнок", 5500, 16],
  ["pet_ghost", "pet", "Призрак Бу", 7000, 24], ["pet_dragon", "pet", "Дракончик", 15000, 40],
].map(([id, slot, name, price, lvl]) => ({
  id, slot, name, price, lvl,
  rarity: price < 1000 ? "common" : price < 3000 ? "rare" : price < 7000 ? "epic" : "legend",
}));
const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const RARITY = { common: "Обычный", rare: "Редкий", epic: "Эпический", legend: "Легендарный" };

/* ---------- достижения ---------- */
const ACHIEVEMENTS = [
  { id: "first_order", icon: "star", title: "Первый шаг", desc: "Добавь первый заказ", target: 1, v: s => s.orders, xp: 100, m: 50 },
  { id: "first_pay", icon: "coin", title: "Первая монета", desc: "Получи первую оплату", target: 1, v: s => s.paidOrders, xp: 150, m: 50 },
  { id: "orders_10", icon: "list", title: "Разогрев", desc: "10 заказов", target: 10, v: s => s.orders, xp: 300, m: 100 },
  { id: "orders_50", icon: "list", title: "Конвейер", desc: "50 заказов", target: 50, v: s => s.orders, xp: 800, m: 250 },
  { id: "orders_100", icon: "rocket", title: "Сотня", desc: "100 заказов", target: 100, v: s => s.orders, xp: 1500, m: 500 },
  { id: "orders_300", icon: "rocket", title: "Фабрика", desc: "300 заказов", target: 300, v: s => s.orders, xp: 4000, m: 1200 },
  { id: "earn_100k", icon: "coin", title: "Первые 100К", desc: "Заработай 100 000 ₽ за всё время", target: 100000, money: true, v: s => s.total, xp: 500, m: 150 },
  { id: "earn_500k", icon: "coin", title: "Полмиллиона", desc: "Заработай 500 000 ₽", target: 500000, money: true, v: s => s.total, xp: 2000, m: 600 },
  { id: "earn_1m", icon: "gem", title: "Миллионер", desc: "Заработай 1 000 000 ₽", target: 1e6, money: true, v: s => s.total, xp: 5000, m: 1500 },
  { id: "earn_3m", icon: "gem", title: "Тройной миллион", desc: "Заработай 3 000 000 ₽", target: 3e6, money: true, v: s => s.total, xp: 10000, m: 3000 },
  { id: "earn_5m", icon: "crown", title: "Финансовый титан", desc: "Заработай 5 000 000 ₽", target: 5e6, money: true, v: s => s.total, xp: 20000, m: 5000 },
  { id: "month_50k", icon: "chart", title: "Хороший месяц", desc: "50 000 ₽ за один месяц", target: 50000, money: true, v: s => s.bestMonth, xp: 400, m: 100 },
  { id: "month_100k", icon: "chart", title: "Шестизначный", desc: "100 000 ₽ за один месяц", target: 100000, money: true, v: s => s.bestMonth, xp: 1500, m: 400 },
  { id: "month_150k", icon: "fire", title: "Рекордсмен", desc: "150 000 ₽ за один месяц", target: 150000, money: true, v: s => s.bestMonth, xp: 3000, m: 800 },
  { id: "clients_5", icon: "users", title: "Сарафанное радио", desc: "5 разных клиентов", target: 5, v: s => s.clients, xp: 300, m: 100 },
  { id: "clients_15", icon: "users", title: "Своя база", desc: "15 разных клиентов", target: 15, v: s => s.clients, xp: 1000, m: 300 },
  { id: "clients_40", icon: "users", title: "Нетворкинг", desc: "40 разных клиентов", target: 40, v: s => s.clients, xp: 3000, m: 800 },
  { id: "loyal_5", icon: "heart", title: "Постоянный клиент", desc: "5 заказов от одного клиента", target: 5, v: s => s.loyal, xp: 500, m: 150 },
  { id: "loyal_20", icon: "heart", title: "Лучшие друзья", desc: "20 заказов от одного клиента", target: 20, v: s => s.loyal, xp: 1500, m: 400 },
  { id: "ontime_10", icon: "clock", title: "Пунктуальность", desc: "Сдай 10 заказов до дедлайна", target: 10, v: s => s.onTime, xp: 600, m: 200 },
  { id: "ontime_50", icon: "clock", title: "Швейцарские часы", desc: "Сдай 50 заказов до дедлайна", target: 50, v: s => s.onTime, xp: 2500, m: 700 },
  { id: "zero_debt", icon: "check", title: "Чистый лист", desc: "Закрой месяц (от 5 заказов) без долгов", target: 1, v: s => s.zeroDebtMonths, xp: 800, m: 250 },
  { id: "goal_1", icon: "target", title: "В яблочко", desc: "Выполни цель месяца", target: 1, v: s => s.goalMonths, xp: 500, m: 150 },
  { id: "goal_6", icon: "target", title: "Стабильность", desc: "Выполни цель в 6 разных месяцах", target: 6, v: s => s.goalMonths, xp: 3000, m: 800 },
  { id: "big_check", icon: "bolt", title: "Крупная рыба", desc: "Заказ от 20 000 ₽", target: 20000, money: true, v: s => s.maxCheck, xp: 400, m: 100 },
  { id: "huge_check", icon: "bolt", title: "Кит", desc: "Заказ от 50 000 ₽", target: 50000, money: true, v: s => s.maxCheck, xp: 1500, m: 400 },
  { id: "streak_4", icon: "fire", title: "В ритме", desc: "4 недели подряд с оплатами", target: 4, v: s => s.bestStreak, xp: 500, m: 150 },
  { id: "streak_12", icon: "fire", title: "Неудержимый", desc: "12 недель подряд с оплатами", target: 12, v: s => s.bestStreak, xp: 2000, m: 500 },
  { id: "shop_1", icon: "shop", title: "Обновка", desc: "Купи первый предмет", target: 1, v: s => s.bought, xp: 100, m: 0 },
  { id: "shop_10", icon: "shop", title: "Модник", desc: "Собери 10 предметов", target: 10, v: s => s.bought, xp: 800, m: 200 },
  { id: "pet", icon: "heart", title: "Лучший друг", desc: "Заведи питомца", target: 1, v: s => s.pets, xp: 300, m: 100 },
  // уровневые дают только материю, чтобы не было петли «уровень → опыт → уровень»
  { id: "level_10", icon: "badge", title: "Двузначный", desc: "Достигни 10 уровня", target: 10, v: s => s.level, xp: 0, m: 400, levelBased: true },
  { id: "level_25", icon: "badge", title: "Четверть сотни", desc: "Достигни 25 уровня", target: 25, v: s => s.level, xp: 0, m: 1000, levelBased: true },
  { id: "level_50", icon: "crown", title: "Полвека", desc: "Достигни 50 уровня", target: 50, v: s => s.level, xp: 0, m: 3000, levelBased: true },
];

/* ---------- расчёт ---------- */
function computeStats() {
  const st = Store.state, orders = st.orders, goal = st.settings.monthlyGoal;
  const curMonth = monthKey(todayISO());
  let total = 0, paidOrders = 0, maxCheck = 0, onTime = 0;
  const months = new Map(), clients = new Map(), weeks = new Set();
  const byPay = st.settings.incomeBy === "payment";
  const month = k => { if (!months.has(k)) months.set(k, { received: 0, debt: 0, count: 0 }); return months.get(k); };
  for (const o of orders) {
    // деньги: все платежи, кроме перенесённых из Excel (архив опыта не даёт)
    for (const p of o.payments) {
      if (p.imported) continue;
      total += p.amount;
      // у архивного заказа новые оплаты всегда идут в месяц оплаты, чтобы не «закрывать» цели прошлых лет
      month(monthKey(byPay || o.imported ? (p.date || todayISO()) : o.date)).received += p.amount;
    }
    if (o.imported) continue;
    if (o.received > 0) { paidOrders++; weeks.add(weekStart(o.date)); }
    maxCheck = Math.max(maxCheck, o.received);
    if (o.done && o.deadline && o.doneDate && o.doneDate <= o.deadline) onTime++;
    const m = month(monthKey(o.date));
    m.debt += debtOf(o); m.count++;
    const c = o.client.trim();
    if (c) clients.set(c, (clients.get(c) || 0) + 1);
  }
  let bestMonth = 0, goalMonths = 0, zeroDebtMonths = 0;
  for (const [k, m] of months) {
    bestMonth = Math.max(bestMonth, m.received);
    if (goal > 0 && m.received >= goal) goalMonths++;
    if (k < curMonth && m.count >= 5 && m.debt === 0) zeroDebtMonths++;
  }
  // серии недель с оплатами
  const wk = Array.from(weeks).sort();
  let bestStreak = 0, run = 0, prev = null;
  for (const w of wk) { run = prev && daysBetween(prev, w) === 7 ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); prev = w; }
  const thisWeek = weekStart(todayISO());
  let curStreak = 0;
  if (wk.length) {
    const last = wk[wk.length - 1];
    if (last === thisWeek || daysBetween(last, thisWeek) === 7) {
      curStreak = 1;
      for (let i = wk.length - 1; i > 0 && daysBetween(wk[i - 1], wk[i]) === 7; i--) curStreak++;
    }
  }
  const bought = st.game.owned.filter(id => ITEM_BY_ID[id] && ITEM_BY_ID[id].price > 0).length;
  return {
    total, paidOrders, maxCheck, onTime, bestMonth, goalMonths, zeroDebtMonths, bestStreak, curStreak, bought,
    orders: orders.filter(o => !o.imported).length, clients: clients.size, loyal: Math.max(0, ...clients.values()),
    pets: st.game.owned.filter(id => id.startsWith("pet_")).length,
    level: 1,
  };
}

function computeTotals(stats) {
  const g = Store.game;
  let achXP = 0, achM = 0;
  for (const a of ACHIEVEMENTS) if (g.achievements[a.id]) { achXP += a.xp; achM += a.m; }
  const moneyXP = Math.floor(stats.total / ECON.rubPerXP);
  const onTimeXP = stats.onTime * ECON.onTimeXP;
  const goalXP = stats.goalMonths * ECON.goalXP;
  const xp = moneyXP + onTimeXP + goalXP + achXP;
  const lv = levelFromXP(xp);
  const earnedMatter = Math.floor(stats.total / ECON.rubPerMatter) + stats.goalMonths * ECON.goalMatter + achM;
  return {
    xp, ...lv, moneyXP, onTimeXP, goalXP, achXP, achM, earnedMatter,
    spent: spentMatter(), matter: earnedMatter - spentMatter(),
    stage: stageFor(lv.level), title: titleFor(lv.level),
  };
}

/** Потрачено = цена всех купленных вещей (так покупки корректно сливаются при синхронизации). */
function spentMatter() { return Store.game.owned.reduce((s, id) => s + (ITEM_BY_ID[id]?.price || 0), 0); }

let G = null;   // последний расчёт — используется вкладками
let gameReady = false;

/** Пересчитать игру; открыть новые достижения; показать повышение уровня. */
function evaluateGame(silent = false) {
  const g = Store.game;
  const stats = computeStats();
  const fresh = [];
  const unlock = levelPass => {
    for (const a of ACHIEVEMENTS) {
      if (g.achievements[a.id] || !!a.levelBased !== levelPass) continue;
      if (a.v(stats) >= a.target) { g.achievements[a.id] = todayISO(); fresh.push(a); }
    }
  };
  unlock(false);
  let totals = computeTotals(stats);
  stats.level = totals.level;
  unlock(true);
  totals = computeTotals(stats);
  stats.level = totals.level;

  G = { stats, ...totals };
  let changed = fresh.length > 0;

  if (!silent && gameReady && Store.settings.showGame && Store.settings.gameNotify) {
    if (fresh.length > 3) toast(`Открыто достижений: ${fresh.length}`, fresh.map(a => a.title).join(", "), "ok", "trophy");
    else fresh.forEach(a => toast(`Достижение: ${a.title}`, `+${fmt(a.xp)} XP · +${fmt(a.m)} ◆`, "ok", "trophy"));
    if (G.level > g.lastLevel) showLevelUp(G.level);
  }
  if (G.level !== g.lastLevel) { g.lastLevel = G.level; changed = true; }
  if (changed) Store.save();
  return G;
}

function buyItem(id) {
  const it = ITEM_BY_ID[id], g = Store.game;
  if (!it || g.owned.includes(id)) return;
  if (G.level < it.lvl) return toast("Рано", `Нужен ${it.lvl} уровень`, "warn", "lock");
  if (G.matter < it.price) return toast("Не хватает материи", `Нужно ещё ${fmt(it.price - G.matter)} ◆`, "warn", "matter");
  g.owned.push(id);
  g.equipped[it.slot] = id;
  toast(`Куплено: ${it.name}`, `−${fmt(it.price)} ◆ · уже надето`, "ok", "shop");
  Store.commit("game");
}

function toggleEquip(id) {
  const it = ITEM_BY_ID[id], g = Store.game;
  if (!it || !g.owned.includes(id)) return;
  if (g.equipped[it.slot] === id) g.equipped[it.slot] = it.slot === "skin" ? "skin_graphite" : null;
  else g.equipped[it.slot] = id;
  Store.commit("game");
}

function showLevelUp(level) {
  const colors = ["#C2F02F", "#ffffff", "#6fb6ff", "#ffd257", "#b48cff"];
  const conf = Array.from({ length: 46 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${1.6 + Math.random() * 1.6}s;animation-delay:${Math.random() * .5}s"></i>`).join("");
  const newStage = EVOLUTION.find(e => e.lvl === level);
  const unlocked = ITEMS.filter(i => i.lvl === level);
  const m = openModal(`
    <div class="confetti">${conf}</div>
    <div class="muted" style="font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:12px">Новый уровень</div>
    <div class="lu-num">${level}</div>
    <div class="stage">${renderCharacter({ ...Store.game.equipped, stage: stageFor(level), animate: true })}</div>
    <h3>${esc(titleFor(level))}</h3>
    <p>${newStage ? `Эволюция: <b class="lime">${newStage.name}</b>. ` : ""}${unlocked.length ? `Открыто в магазине: ${unlocked.map(i => esc(i.name)).join(", ")}.` : "Так держать — следующий уровень ближе, чем кажется."}</p>
    <div class="m-actions" style="justify-content:center"><button class="btn primary" id="luOk">Отлично!</button></div>`, "levelup");
  m.querySelector("#luOk").onclick = closeModal;
}

/* ---------- Летопись: рекорды за всё время, включая архив (без наград) ---------- */
function computeChronicle() {
  const entries = incomeEntries();
  const orders = Store.orders;
  if (!orders.length) return null;
  const months = new Map(), years = new Map(), clientsSum = new Map(), clientsCnt = new Map(), services = new Map();
  const mon = k => { if (!months.has(k)) months.set(k, { key: k, income: 0, count: 0 }); return months.get(k); };
  for (const e of entries) mon(monthKey(e.date)).income += e.amount;
  for (const o of orders) {
    mon(monthKey(o.date)).count++;
    const c = o.client.trim(), sk = serviceKey(o.service);
    if (c) { clientsSum.set(c, (clientsSum.get(c) || 0) + o.received); clientsCnt.set(c, (clientsCnt.get(c) || 0) + 1); }
    if (sk) services.set(sk, (services.get(sk) || { name: o.service.trim(), count: 0 })), services.get(sk).count++;
  }
  for (const m of months.values()) {
    const y = m.key.slice(0, 4);
    if (!years.has(y)) years.set(y, { year: y, income: 0, count: 0, months: 0, best: null });
    const Y = years.get(y);
    Y.income += m.income; Y.count += m.count; if (m.count || m.income) Y.months++;
    if (!Y.best || m.income > Y.best.income) Y.best = m;
  }
  const ms = [...months.values()].sort((a, b) => a.key.localeCompare(b.key));
  const top = (map) => [...map.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const goal = Store.settings.monthlyGoal;
  let run = 0, bestRun = 0, runEnd = null;
  for (let k = ms[0].key; k <= monthKey(todayISO()); k = shiftMonth(k, 1)) {
    const inc = months.get(k)?.income || 0;
    if (goal && inc >= goal) { run++; if (run > bestRun) { bestRun = run; runEnd = k; } } else run = 0;
  }
  const biggest = [...orders].sort((a, b) => b.price - a.price)[0];
  const svc = [...services.values()].sort((a, b) => b.count - a.count)[0];
  const [richName, richSum] = top(clientsSum) || ["—", 0];
  const [freqName, freqCnt] = top(clientsCnt) || ["—", 0];
  return {
    total, orders: orders.length, clients: clientsCnt.size, first: ms[0].key,
    bestMonth: [...months.values()].sort((a, b) => b.income - a.income)[0],
    busiest: [...months.values()].sort((a, b) => b.count - a.count)[0],
    years: [...years.values()].sort((a, b) => b.year.localeCompare(a.year)),
    bestYear: [...years.values()].sort((a, b) => b.income - a.income)[0],
    biggest, svc, richName, richSum, richShare: total ? Math.round(richSum / total * 100) : 0, freqName, freqCnt,
    bestRun, runEnd, avgMonth: total / Math.max(1, ms.filter(m => m.income > 0).length),
  };
}
