/* Копилка: цели накоплений. С каждой оплаты после старта цели откладывается процент + ручные взносы. */
function piggyKpiHTML() {
  const goals = Store.state.goals;
  if (!goals.length) return `<div class="card kpi piggy-kpi clickable"><div class="k-label">${icon("piggy")}Копилка</div>
    <div class="k-val small-val">Добавить цель</div><div class="k-foot">откладывать % с каждой оплаты</div></div>`;
  const g = goals[0], saved = goalSaved(g), p = g.target ? Math.min(100, saved / g.target * 100) : 0;
  return `<div class="card kpi piggy-kpi clickable" title="Открыть копилку"><div class="k-label">${icon("piggy")}${esc(g.name)}${goals.length > 1 ? ` <span class="muted">+${goals.length - 1}</span>` : ""}</div>
    <div class="k-val">${fmt(saved)}<small>₽</small></div>
    <div class="goalbar"><i style="width:${p}%"></i></div><div class="k-foot">${Math.round(p)}% из ${money(g.target)} · ${g.percent}% с оплат</div></div>`;
}

const Piggy = {
  open() {
    const goals = Store.state.goals;
    const m = openModal(`
      <div class="sheet-head"><h3>${icon("piggy")} Копилка</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
      <p>С каждой оплаты, полученной после начала цели, откладывается выбранный процент. Можно добавить или снять деньги вручную.</p>
      <div class="goal-list">${goals.map(g => {
        const saved = goalSaved(g), p = g.target ? Math.min(100, saved / g.target * 100) : 0;
        const left = Math.max(0, g.target - saved), monthly = this.monthlyPace(g);
        return `<div class="goal" data-id="${g.id}">
          <div class="goal-top"><b>${esc(g.name)}</b><span class="muted small">с ${shortDate(g.since, true)}</span><div class="spacer"></div>
            <button class="mini-ico" data-a="edit" title="Изменить">${icon("edit")}</button><button class="mini-ico del" data-a="del" title="Удалить цель">${icon("trash")}</button></div>
          <div class="goal-sum"><b>${money(saved)}</b><span class="muted"> из ${money(g.target)}</span></div>
          <div class="goalbar"><i style="width:${p}%"></i></div>
          <div class="muted small">${p >= 100 ? "Цель достигнута 🎉" : `осталось ${money(left)}${monthly ? ` · при текущем темпе ≈ ${Math.ceil(left / monthly)} мес.` : ""}`} · ${g.percent}% с каждой оплаты</div>
          <div class="row tight" style="margin-top:10px"><input class="field" data-a="amount" inputmode="numeric" placeholder="Сумма, ₽"><button class="btn sm" data-a="add">${icon("plus")} Внести</button><button class="btn sm ghost" data-a="take">Снять</button></div>
        </div>`;
      }).join("") || `<div class="muted" style="padding:6px 2px 12px">Целей пока нет</div>`}</div>
      <div class="m-actions"><button class="btn primary" data-new>${icon("plus")} Новая цель</button></div>`, "wide");
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = closeModal);
    m.querySelector("[data-new]").onclick = () => this.edit();
    m.querySelectorAll(".goal").forEach(el => {
      const g = goals.find(x => x.id === el.dataset.id);
      const amount = () => parseMoney(el.querySelector('[data-a="amount"]').value);
      el.querySelector('[data-a="edit"]').onclick = () => this.edit(g);
      el.querySelector('[data-a="del"]').onclick = async () => {
        if (!await confirmBox("Удалить цель?", `«${g.name}» — накопленная сумма просто перестанет считаться.`, "Удалить", true)) return this.open();
        Store.state.goals = goals.filter(x => x !== g); Store.commit("goals"); this.open();
      };
      el.querySelector('[data-a="add"]').onclick = () => { if (amount()) { g.manual += amount(); Store.commit("goals"); this.open(); } };
      el.querySelector('[data-a="take"]').onclick = () => { if (amount()) { g.manual -= Math.min(amount(), goalSaved(g)); Store.commit("goals"); this.open(); } };
    });
  },
  /** Сколько в среднем откладывается в месяц (по последним 3 месяцам). */
  monthlyPace(g) {
    const from = addMonths(todayISO(), -3) > g.since ? addMonths(todayISO(), -3) : g.since;
    let sum = 0;
    for (const o of Store.orders) for (const p of o.payments) if (!p.imported && p.date && p.date >= from) sum += p.amount;
    const months = Math.max(1, daysBetween(from, todayISO()) / 30.44);
    return Math.round(sum * g.percent / 100 / months);
  },
  edit(g = null) {
    const isNew = !g;
    g = g || { name: "", target: 0, percent: 10, since: todayISO() };
    const m = openModal(`<h3>${isNew ? "Новая цель" : "Цель"}</h3><p>Например, «Новый ноутбук» на 150 000 ₽, откладывать 10% с каждой оплаты.</p>
      <div class="form-grid">
        <label class="span2">Название<input class="field" data-f="name" value="${esc(g.name)}" placeholder="Новый ноутбук"></label>
        <label>Сумма цели, ₽<input class="field" data-f="target" inputmode="numeric" value="${g.target ? fmt(g.target) : ""}"></label>
        <label>Откладывать с оплат, %<input class="field" data-f="percent" type="number" min="0" max="100" value="${g.percent}"></label>
        <label class="span2">Считать оплаты начиная с<input class="field" data-f="since" type="date" value="${g.since}"></label>
      </div>
      <div class="m-actions"><button class="btn" data-r="0">Отмена</button><button class="btn primary" data-r="1">Сохранить</button></div>`);
    const v = f => m.querySelector(`[data-f="${f}"]`).value.trim();
    m.querySelector('[data-r="0"]').onclick = () => this.open();
    m.querySelector('[data-r="1"]').onclick = () => {
      const data = { name: v("name") || "Цель", target: parseMoney(v("target")), percent: Math.max(0, Math.min(100, parseFloat(v("percent")) || 0)), since: v("since") || todayISO() };
      if (isNew) Store.state.goals.push(normalizeGoal(data)); else Object.assign(g, data);
      Store.commit("goals");
      this.open();
    };
  },
};
