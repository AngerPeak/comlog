/* Вкладки «Герой», «Магазин», «Достижения». */
const HeroView = {
  render() {
    const g = Store.game, st = G.stats, s = Store.settings;
    const pct = (G.into / G.need) * 100;
    const curKey = monthKey(todayISO()), curMonth = rangeStats(monthStart(curKey), monthEnd(curKey));
    const goal = s.monthlyGoal, gp = goal ? Math.min(1, curMonth.received / goal) : 0;
    const days = daysBetween(Store.state.createdAt, todayISO()) + 1;
    const nextEvo = EVOLUTION.find(e => e.lvl > G.level);
    const C = 2 * Math.PI * 48;

    $("#page-hero").innerHTML = `
      <div class="hero-layout">
        <div class="card hero-card">
          <div class="stage">${renderCharacter({ ...g.equipped, stage: G.stage, animate: true })}</div>
          <div class="hero-name">${esc(s.heroName)}</div>
          <div class="hero-title">${esc(G.title)} · стадия «${EVOLUTION[G.stage].name}»</div>
          <div class="hero-stats">
            <div><div class="hs-top">${icon("badge")}${G.level}</div><div class="hs-label">Уровень</div></div>
            <div><div class="hs-top">${icon("fire")}${st.curStreak}</div><div class="hs-label">${plural(st.curStreak, "неделя", "недели", "недель")} подряд</div></div>
            <div><div class="hs-top">${icon("cal")}${days}</div><div class="hs-label">${plural(days, "день", "дня", "дней")} с COMLOG</div></div>
          </div>
          <div class="xp-big">
            <div class="xb-row"><span>Опыт до ${G.level + 1} уровня</span><span><b>${fmt(G.into)}</b> / ${fmt(G.need)} XP</span></div>
            <div class="xpbar"><i style="width:${pct}%"></i></div>
            <div class="xb-row" style="margin-top:8px"><span>Всего опыта: ${fmt(G.xp)} XP</span><span>≈ ${money(Math.max(0, G.need - G.into) * ECON.rubPerXP)} до апа</span></div>
          </div>
        </div>

        <div class="grid">
          <div class="promo">
            <h4>Материя: ${fmt(G.matter)} ◆</h4>
            <p>Каждые ${ECON.rubPerMatter} ₽ полученных денег превращаются в 1 ◆. Трать её на скины, аксессуары и питомцев.</p>
            <div style="margin-top:14px"><button class="btn primary sm" data-goto="shop">${icon("shop")} В магазин</button></div>
            <svg class="promo-art matter-ico" viewBox="0 0 24 24" style="width:96px;height:96px;filter:drop-shadow(0 10px 30px rgba(194,240,47,.45))"><use href="#i-matter"/></svg>
          </div>

          <div class="card">
            <h3>${icon("target")}Цель месяца<span class="sub">${monthTitle(monthKey(todayISO()))}</span></h3>
            <div class="row" style="gap:20px">
              <div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="#222" stroke-width="10"/>
                <circle cx="56" cy="56" r="48" fill="none" stroke="#C2F02F" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - gp)}"/></svg>
                <div class="ring-val"><div>${Math.round(gp * 100)}%<small>цели</small></div></div></div>
              <div style="flex:1">
                <div style="font-size:22px;font-weight:750">${money(curMonth.received)} <span class="muted" style="font-size:15px;font-weight:550">из ${money(goal)}</span></div>
                <div class="muted" style="margin:4px 0 10px">${gp >= 1 ? "Цель выполнена! Бонус начислен 🎯" : `Осталось ${money(goal - curMonth.received)}`}</div>
                <span class="tag lime">+${fmt(ECON.goalXP)} XP</span> <span class="tag lime">+${ECON.goalMatter} ◆</span> <span class="muted" style="font-size:12px">за выполнение</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>${icon("bolt")}Откуда опыт</h3>
            <div class="rule-list">
              <div class="rule"><div class="r-ico">${icon("coin")}</div><div class="r-main"><div>Полученные деньги</div><div>${ECON.rubPerXP} ₽ = 1 XP</div></div><div class="r-val">${fmt(G.moneyXP)} XP</div></div>
              <div class="rule"><div class="r-ico">${icon("clock")}</div><div class="r-main"><div>Сдано до дедлайна</div><div>+${ECON.onTimeXP} XP за каждый заказ · ${st.onTime} шт.</div></div><div class="r-val">${fmt(G.onTimeXP)} XP</div></div>
              <div class="rule"><div class="r-ico">${icon("target")}</div><div class="r-main"><div>Выполненные цели месяца</div><div>+${fmt(ECON.goalXP)} XP · ${st.goalMonths} ${plural(st.goalMonths, "месяц", "месяца", "месяцев")}</div></div><div class="r-val">${fmt(G.goalXP)} XP</div></div>
              <div class="rule"><div class="r-ico">${icon("trophy")}</div><div class="r-main"><div>Достижения</div><div>${Object.keys(g.achievements).length} из ${ACHIEVEMENTS.length} открыто</div></div><div class="r-val">${fmt(G.achXP)} XP</div></div>
            </div>
            ${(() => { const n = Store.orders.filter(o => o.imported).length; return n ? `<div class="muted" style="font-size:12.5px;margin-top:10px">Архив из Excel (${n} ${plural(n, "заказ", "заказа", "заказов")}) виден в учёте, но не даёт опыта. Засчитываются только долги, оплаченные уже в COMLOG.</div>` : ""; })()}
          </div>

          <div class="card">
            <h3>${icon("rocket")}Эволюция<span class="sub">${nextEvo ? `следующая — на ${nextEvo.lvl} уровне` : "максимальная стадия"}</span></h3>
            <div class="evo">${EVOLUTION.map((e, i) => `<div class="evo-step ${i === G.stage ? "on" : ""} ${G.level < e.lvl ? "locked" : ""}" title="${e.desc}">
              <div class="e-lvl">ур. ${e.lvl}</div><div class="e-name">${e.name}</div></div>`).join("")}</div>
          </div>

          <div class="card">
            <h3>${icon("user")}Экипировка<span class="sub"><button class="btn sm ghost" data-goto="shop">изменить</button></span></h3>
            <div class="equip">${Object.entries(SLOTS).map(([slot, label]) => {
              const it = ITEM_BY_ID[g.equipped[slot]];
              return `<div class="equip-slot"><div class="es-k">${label}</div><div class="es-v ${it ? "" : "none"}">${it ? esc(it.name) : "пусто"}</div></div>`;
            }).join("")}</div>
          </div>
        </div>
      </div>`;
  },
};

const ShopView = {
  cat: "all",
  render() {
    const g = Store.game;
    const cats = [["all", "Все"], ...Object.entries(SLOTS).map(([k, v]) => [k, v === "Головной убор" ? "Головные уборы" : v === "Скин" ? "Скины" : v === "Аксессуар" ? "Аксессуары" : v === "Аура" ? "Ауры" : v === "Питомец" ? "Питомцы" : v]), ["owned", "Мои вещи"]];
    let items = ITEMS.filter(i => i.price > 0 || i.slot === "skin");
    if (this.cat === "owned") items = items.filter(i => g.owned.includes(i.id));
    else if (this.cat !== "all") items = items.filter(i => i.slot === this.cat);

    $("#page-shop").innerHTML = `
      <div class="shop-head">
        <div class="matter-pill" style="font-size:20px;padding:8px 18px 8px 12px;cursor:default"><svg class="matter-ico" style="width:28px;height:28px"><use href="#i-matter"/></svg><b>${fmt(G.matter)}</b></div>
        <div class="muted">Собрано ${g.owned.length - 1} из ${ITEMS.length - 1} предметов · уровень ${G.level}</div>
        <div class="spacer"></div>
        <div class="seg" id="shopCats">${cats.map(([k, l]) => `<button data-c="${k}" class="${this.cat === k ? "on" : ""}">${l}</button>`).join("")}</div>
      </div>
      <div class="shop-grid">${items.map(it => this.card(it)).join("") || `<div class="muted">Здесь пока пусто</div>`}</div>`;

    $$("#shopCats button").forEach(b => b.onclick = () => { this.cat = b.dataset.c; this.render(); });
    $$("#page-shop [data-buy]").forEach(b => b.onclick = () => buyItem(b.dataset.buy));
    $$("#page-shop [data-equip]").forEach(b => b.onclick = () => toggleEquip(b.dataset.equip));
  },

  card(it) {
    const g = Store.game;
    const owned = g.owned.includes(it.id), equipped = g.equipped[it.slot] === it.id;
    const locked = !owned && G.level < it.lvl;
    const preview = renderCharacter({ ...g.equipped, [it.slot]: it.id, ...(it.slot === "pet" ? { aura: null } : {}), stage: G.stage });
    let action;
    if (owned) action = `<button class="btn sm ${equipped ? "" : "primary"}" data-equip="${it.id}">${equipped ? (it.slot === "skin" && it.id === "skin_graphite" ? "Надето" : "Снять") : "Надеть"}</button>`;
    else if (locked) action = `<button class="btn sm" disabled>${icon("lock")} ур. ${it.lvl}</button>`;
    else if (G.matter < it.price) action = `<button class="btn sm" disabled title="Не хватает ${fmt(it.price - G.matter)} ◆">Мало ◆</button>`;
    else action = `<button class="btn sm primary" data-buy="${it.id}">Купить</button>`;
    return `<div class="item ${equipped ? "equipped" : ""} ${locked ? "locked" : ""}">
      <div class="it-prev">${preview}${locked ? `<div class="lock-ov"><span>${icon("lock")} Откроется на ${it.lvl} ур.</span></div>` : ""}
        <span class="tag it-rar rar-${it.rarity}">${RARITY[it.rarity]}</span></div>
      <div class="it-name">${esc(it.name)}</div>
      <div class="it-slot">${SLOTS[it.slot]}${it.lvl > 1 ? ` · с ${it.lvl} ур.` : ""}</div>
      <div class="it-foot">${owned ? `<span class="tag lime">${icon("check", "")} Есть</span>` : `<span class="price"><svg><use href="#i-matter"/></svg>${it.price ? fmt(it.price) : "0"}</span>`}${action}</div>
    </div>`;
  },
};

function chronicleHTML() {
  const c = computeChronicle();
  if (!c) return `<div class="card empty-state"><div class="es-ico">${icon("book")}</div><h4>Летопись пока пуста</h4><div>Здесь появятся рекорды, когда накопятся заказы</div></div>`;
  const mt = k => monthTitle(k);
  const cards = [
    ["coin", "Заработано за всё время", money(c.total), `с ${mt(c.first)} · в среднем ${money(c.avgMonth)} в месяц`],
    ["crown", "Лучший месяц", money(c.bestMonth.income), mt(c.bestMonth.key)],
    ["star", "Лучший год", money(c.bestYear.income), `${c.bestYear.year} · ${c.bestYear.count} ${plural(c.bestYear.count, "заказ", "заказа", "заказов")}`],
    ["fire", "Самый загруженный месяц", `${c.busiest.count} ${plural(c.busiest.count, "заказ", "заказа", "заказов")}`, mt(c.busiest.key)],
    ["gem", "Самый крупный заказ", money(c.biggest.price), `${c.biggest.client || "—"} · ${c.biggest.service || "—"}`],
    ["heart", "Главный клиент", c.richName, `${money(c.richSum)} · ${c.richShare}% всего дохода`],
    ["users", "Чаще всех заказывал", c.freqName, `${c.freqCnt} ${plural(c.freqCnt, "заказ", "заказа", "заказов")}`],
    ["tag", "Хит среди услуг", c.svc ? c.svc.name : "—", c.svc ? `${c.svc.count} ${plural(c.svc.count, "раз", "раза", "раз")}` : ""],
    ["target", "Цель месяца подряд", c.bestRun ? `${c.bestRun} ${plural(c.bestRun, "месяц", "месяца", "месяцев")}` : "пока нет", c.bestRun ? `рекорд закончился в ${MONTHS_PREP[+c.runEnd.slice(5) - 1]} ${c.runEnd.slice(0, 4)}` : `цель ${money(Store.settings.monthlyGoal)}`],
    ["list", "Всего заказов", fmt(c.orders), `${c.clients} ${plural(c.clients, "клиент", "клиента", "клиентов")}`],
  ];
  const maxY = Math.max(...c.years.map(y => y.income), 1);
  return `
    <div class="card chron-head">
      <div class="ch-ico">${icon("book")}</div>
      <div><div style="font-size:22px;font-weight:750">Летопись</div>
        <div class="muted">Рекорды за всю историю, включая перенесённый архив. Наград не дают — это просто ваша история.</div></div>
      <div class="spacer"></div>
      <div class="wr-launch">${wrappedYears().slice(0, 4).map((y, i) => `<button class="btn ${i ? "" : "primary"}" data-wrapped="${y}">${icon("star")} Итоги ${y}</button>`).join("")}</div>
    </div>
    <div class="chron-grid">${cards.map(([ic, t, v, s]) => `<div class="chron"><div class="c-ico">${icon(ic)}</div>
      <div class="c-main"><div class="c-t">${t}</div><div class="c-v">${esc(v)}</div><div class="c-s">${esc(s)}</div></div></div>`).join("")}</div>
    <div class="card" style="margin-top:14px"><h3>${icon("cal")}По годам</h3>
      <div class="years">${c.years.map(y => `<div class="year-row">
        <b>${y.year}</b>
        <div class="br-track"><i style="width:${(y.income / maxY) * 100}%"></i></div>
        <span class="num">${money(y.income)}</span>
        <span class="muted small">${y.count} заказ. · лучший — ${MONTHS_SHORT[+y.best.key.slice(5) - 1]} (${compactMoney(y.best.income)})</span>
      </div>`).join("")}</div></div>`;
}

const AchievementsView = {
  tab: "ach",
  render() {
    const showGame = Store.settings.showGame;
    if (!showGame) { $("#page-achievements").innerHTML = chronicleHTML(); return; }
    $("#page-achievements").innerHTML = `<div class="seg" id="achTabs" style="margin-bottom:16px">
      <button data-t="ach" class="${this.tab === "ach" ? "on" : ""}">${icon("trophy")}Достижения</button>
      <button data-t="chron" class="${this.tab === "chron" ? "on" : ""}">${icon("book")}Летопись</button></div><div id="achBody"></div>`;
    $$("#achTabs button").forEach(b => b.onclick = () => { this.tab = b.dataset.t; this.render(); });
    if (this.tab === "chron") { $("#achBody").innerHTML = chronicleHTML(); return; }
    this.renderAchievements();
  },
  renderAchievements() {
    const g = Store.game, st = G.stats;
    const opened = ACHIEVEMENTS.filter(a => g.achievements[a.id]).length;
    const sorted = [...ACHIEVEMENTS].sort((a, b) => {
      const da = !!g.achievements[a.id], db = !!g.achievements[b.id];
      if (da !== db) return da ? -1 : 1;
      return Math.min(1, b.v(st) / b.target) - Math.min(1, a.v(st) / a.target);
    });
    const C = 2 * Math.PI * 48;
    $("#achBody").innerHTML = `
      <div class="card ach-summary">
        <div class="ring"><svg viewBox="0 0 112 112"><circle cx="56" cy="56" r="48" fill="none" stroke="#222" stroke-width="10"/>
          <circle cx="56" cy="56" r="48" fill="none" stroke="#C2F02F" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - opened / ACHIEVEMENTS.length)}"/></svg>
          <div class="ring-val"><div>${opened}<small>из ${ACHIEVEMENTS.length}</small></div></div></div>
        <div><div style="font-size:22px;font-weight:750">Достижения</div>
          <div class="muted">Получено наград: ${fmt(G.achXP)} XP и ${fmt(G.achM)} ◆. Открытые достижения остаются навсегда.</div></div>
      </div>
      <div class="ach-grid">${sorted.map(a => {
        const done = g.achievements[a.id], v = Math.min(a.v(st), a.target);
        const prog = a.money ? `${compactMoney(v)} / ${compactMoney(a.target)}` : `${fmt(v)} / ${fmt(a.target)}`;
        return `<div class="ach ${done ? "done" : ""}">
          <div class="a-ico">${icon(a.icon)}</div>
          <div class="a-main"><div class="a-title">${esc(a.title)}</div><div class="a-desc">${esc(a.desc)}</div>
            ${done ? `<div class="a-date">Открыто ${shortDate(done)} ${done.slice(0, 4)}</div>` : `<div class="a-prog"><div class="xpbar"><i style="width:${(v / a.target) * 100}%"></i></div><span>${prog}</span></div>`}
            <div class="a-rew">${a.xp ? `<span class="tag ${done ? "lime" : ""}">+${fmt(a.xp)} XP</span>` : ""}${a.m ? `<span class="tag ${done ? "lime" : ""}">+${fmt(a.m)} ◆</span>` : ""}</div>
          </div></div>`;
      }).join("")}</div>`;
  },
};
