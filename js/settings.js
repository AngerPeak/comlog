/* Вкладка «Настройки». */
const ACCENTS = [["#c2f02f", "Лайм"], ["#5ee0b5", "Мята"], ["#6fb6ff", "Небо"], ["#b48cff", "Лаванда"], ["#ff8fb1", "Роза"], ["#ff7a59", "Коралл"], ["#ffb547", "Янтарь"]];
const THEMES = [["dark", "Тёмная"], ["black", "Чёрная"], ["light", "Светлая"]];
const COLUMN_NAMES = { date: "Дата", client: "Клиент", service: "Услуга", price: "Прайс", received: "Получено", done: "Выполнен", paid: "Оплачен", deadline: "Дедлайн" };

const SettingsView = {
  render() {
    const s = Store.settings, api = Store.api();
    const tog = (id, on) => `<button class="toggle ${on ? "on" : ""}" id="${id}"></button>`;
    const row = (title, sub, ctrl) => `<div class="set-row"><div class="sr-l"><div>${title}</div>${sub ? `<div>${sub}</div>` : ""}</div>${ctrl}</div>`;
    $("#page-settings").innerHTML = `
      <div class="settings-grid">
        <div class="grid">
          <div class="card">
            <h3>${icon("palette")}Оформление</h3>
            ${row("Тема", "", `<div class="seg" id="sTheme">${THEMES.map(([k, l]) => `<button data-v="${k}" class="${s.theme === k ? "on" : ""}">${l}</button>`).join("")}</div>`)}
            ${row("Акцентный цвет", "", `<div class="swatches" id="sAccent">${ACCENTS.map(([c, n]) => `<button class="sw ${s.accent === c ? "on" : ""}" data-c="${c}" title="${n}" style="background:${c}"></button>`).join("")}
              <label class="sw custom ${ACCENTS.some(a => a[0] === s.accent) ? "" : "on"}" title="Свой цвет" style="${ACCENTS.some(a => a[0] === s.accent) ? "" : `background:${s.accent}`}"><input type="color" id="sAccentCustom" value="${s.accent}">${icon("edit")}</label></div>`)}
            ${row("Вид заказов на ПК", "На телефоне всегда карточки", `<div class="seg" id="sView"><button data-v="table" class="${s.ordersView === "table" ? "on" : ""}">Таблица</button><button data-v="board" class="${s.ordersView === "board" ? "on" : ""}">Доска</button></div>`)}
            ${row("Цветные столбцы", "Мягкая подсветка столбцов таблицы", tog("sCols", s.colorColumns))}
            <div class="col-colors" ${s.colorColumns ? "" : "hidden"}>${Object.entries(COLUMN_NAMES).map(([k, n]) => `
              <button class="col-chip" data-col="${k}"><i style="background:${s.columnColors[k]}"></i>${n}</button>`).join("")}
              <button class="btn sm ghost" id="sColsReset">Сбросить</button></div>
            ${row("Цвета услуг", "Цвет задаётся во вкладке «Прайс-лист»", tog("sSvc", s.serviceColors))}
          </div>

          <div class="card">
            <h3>${icon("coin")}Учёт</h3>
            ${row("Доход считать по", s.incomeBy === "payment" ? "Заказ сентября, оплаченный в октябре, попадёт в октябрь" : "Заказ сентября, оплаченный в октябре, останется в сентябре",
              `<div class="seg" id="sIncome"><button data-v="order" class="${s.incomeBy === "order" ? "on" : ""}">Дате заказа</button><button data-v="payment" class="${s.incomeBy === "payment" ? "on" : ""}">Дате оплаты</button></div>`)}
            ${row("Цель на месяц, ₽", s.showGame ? `За выполнение: +${fmt(ECON.goalXP)} XP и +${ECON.goalMatter} ◆` : "", `<input class="field" id="sGoal" value="${fmt(s.monthlyGoal)}" inputmode="numeric">`)}
            ${row("Налог самозанятого", "Покажет сумму налога и «на руки»", tog("sTax", s.taxEnabled))}
            ${s.taxEnabled ? row("Ставка налога, %", "4% — с физлиц, 6% — с компаний и ИП", `<input class="field short" id="sTaxRate" value="${s.taxRate}" inputmode="decimal">`) : ""}
            ${row("Почасовая оплата для всех заказов", "У всех невыполненных заказов появится кнопка «Начать», новые заказы без цены сразу почасовые. Готовые заказы и архив не меняются", tog("sHourlyAll", s.hourlyAll))}
            ${row("Ставка за час, ₽", "Включить почасовую можно и у одного заказа — в его карточке (⋯). Ставку у заказа можно поменять", `<input class="field" id="sRate" value="${fmt(s.hourlyRate)}" inputmode="numeric">`)}
            ${row("Округлять время", "Оплачиваемое время округляется вверх", `<select class="field" id="sRound">${[[1, "до минуты"], [5, "до 5 минут"], [10, "до 10 минут"], [15, "до 15 минут"], [30, "до получаса"], [60, "до часа"]].map(([v, l]) => `<option value="${v}" ${s.timeRound === v ? "selected" : ""}>${l}</option>`).join("")}</select>`)}
            ${row("Отмена удаления", "Вместо вопроса «Удалить?» — кнопка «Отменить» на 7 секунд", tog("sUndo", s.undoDelete))}
          </div>

          <div class="card">
            <h3>${icon("user")}Игра</h3>
            ${row("Персонаж и прокачка", "Вкладки «Герой», «Магазин», уровень в боковой панели", tog("sGame", s.showGame))}
            ${s.showGame ? row("Уведомления о прогрессе", "Новые уровни и достижения", tog("sGameNotify", s.gameNotify)) : ""}
            ${s.showGame ? row("Имя героя", "", `<input class="field" id="sName" value="${esc(s.heroName)}" maxlength="24">`) : ""}
            ${s.showGame ? `<div class="rule-list" style="margin-top:8px">
              <div class="rule"><div class="r-ico">${icon("coin")}</div><div class="r-main"><div>${ECON.rubPerXP} ₽ = 1 XP · ${ECON.rubPerMatter} ₽ = 1 ◆</div><div>Только деньги, полученные в COMLOG; архив из Excel не считается</div></div></div>
              <div class="rule"><div class="r-ico">${icon("badge")}</div><div class="r-main"><div>При 70 000 ₽/мес</div><div>10 ур. ≈ 2 месяца · 25 ур. ≈ год · 50 ур. ≈ 4–5 лет</div></div></div></div>` : ""}
          </div>
        </div>

        <div class="grid">
          <div class="card">
            <h3>${icon("bell")}Напоминания</h3>
            ${row("Подсвечивать сроки", "За сколько дней до дедлайна предупреждать в приложении", `<select class="field" id="sRemind">${[1, 2, 3, 5, 7].map(d => `<option value="${d}" ${d === s.remindDays ? "selected" : ""}>за ${d} ${plural(d, "день", "дня", "дней")}</option>`).join("")}</select>`)}
            ${row("Уведомления накануне", "За день до дедлайна, в выбранные часы", `<div class="seg" id="sRemCount"><button data-v="2" class="${s.reminderCount === 2 ? "on" : ""}">2 раза</button><button data-v="3" class="${s.reminderCount === 3 ? "on" : ""}">3 раза</button></div>`)}
            <div class="times">${s.reminderTimes.slice(0, s.reminderCount).map((t, i) => `<input type="time" class="field" data-time="${i}" value="${t}">`).join("")}</div>
            ${api ? row("Уведомления Windows", "Появляются в углу экрана, даже если COMLOG закрыт", tog("sWin", s.winReminders))
                  : `<div class="hint">${icon("info")}<div>На iPhone веб-приложение не умеет присылать уведомления само. Добавьте дедлайны в Календарь — iOS напомнит в эти же часы.</div></div>`}
            <div class="row wrap" style="margin-top:10px">
              ${api ? `<button class="btn sm" id="sTest">${icon("bell")} Тест уведомления</button>` : ""}
              <button class="btn sm" id="sIcs">${icon("cal")} Дедлайны в Календарь (.ics)</button>
            </div>
          </div>

          <div class="card" id="syncBox"></div>

          <div class="card">
            <h3>${icon("download")}Резервная копия</h3>
            <div class="muted" style="margin:-6px 0 14px;font-size:13px">Файл .comlog содержит все заказы, прайс-лист, персонажа и достижения.</div>
            <div class="backup-actions">
              <button class="btn primary" id="bExport">${icon("download")} Сохранить бэкап в файл…</button>
              <button class="btn" id="bImport">${icon("upload")} Восстановить из бэкапа…</button>
              <button class="btn" id="bCsv">${icon("table")} Экспорт заказов в CSV (Excel)</button>
              ${api ? `<button class="btn" id="bFolder">${icon("folder")} Открыть папку с данными</button>` : ""}
            </div>
            <h4 class="sub-h">Автокопии <span class="muted">${api ? "при каждом запуске" : "раз в 12 часов, на этом устройстве"}</span></h4>
            <div class="muted small" id="dataPath"></div>
            <div class="auto-list" id="autoList"><div class="muted">Загрузка…</div></div>
          </div>
        </div>
      </div>`;
    this.bind();
    this.renderSync();
    this.renderAutoList();
  },

  bind() {
    const s = Store.settings, api = Store.api();
    const set = (k, v, rerender = true) => { s[k] = v; Store.commit("settings"); applyTheme(); if (rerender) this.render(); };
    $$("#sTheme button").forEach(b => b.onclick = () => set("theme", b.dataset.v));
    $$("#sAccent [data-c]").forEach(b => b.onclick = () => set("accent", b.dataset.c));
    $("#sAccentCustom").onchange = e => set("accent", e.target.value);
    $$("#sView button").forEach(b => b.onclick = () => set("ordersView", b.dataset.v));
    $("#sCols").onclick = () => set("colorColumns", !s.colorColumns);
    $$(".col-chip").forEach(b => b.onclick = async () => {
      const c = await pickColor(b, s.columnColors[b.dataset.col], false);
      if (c) { s.columnColors[b.dataset.col] = c; set("columnColors", s.columnColors); }
    });
    $("#sColsReset").onclick = () => set("columnColors", { ...DEFAULT_COLUMN_COLORS });
    $("#sSvc").onclick = () => set("serviceColors", !s.serviceColors);
    $$("#sIncome button").forEach(b => b.onclick = () => set("incomeBy", b.dataset.v));
    $("#sGoal").onfocus = e => { e.target.value = String(s.monthlyGoal); };
    $("#sGoal").onchange = e => { s.monthlyGoal = parseMoney(e.target.value); e.target.value = fmt(s.monthlyGoal); Store.commit("settings"); };
    $("#sTax").onclick = () => set("taxEnabled", !s.taxEnabled);
    $("#sTaxRate")?.addEventListener("change", e => { const v = Math.max(0, Math.min(50, parseFloat(e.target.value.replace(",", ".")) || 0)); set("taxRate", v); });
    $("#sRate").onfocus = e => { e.target.value = String(s.hourlyRate); };
    $("#sRate").onchange = e => { s.hourlyRate = parseMoney(e.target.value); e.target.value = fmt(s.hourlyRate); Store.commit("settings"); };
    $("#sHourlyAll").onclick = () => set("hourlyAll", !s.hourlyAll);
    $("#sRound").onchange = e => { s.timeRound = +e.target.value; Store.commit("settings"); };
    $("#sUndo").onclick = () => set("undoDelete", !s.undoDelete);
    $("#sGame").onclick = () => { set("showGame", !s.showGame); evaluateGame(true); renderChrome(); };
    $("#sGameNotify")?.addEventListener("click", () => set("gameNotify", !s.gameNotify));
    $("#sName")?.addEventListener("change", e => { s.heroName = e.target.value.trim() || "Герой"; Store.commit("settings"); renderChrome(); });
    $("#sRemind").onchange = e => { s.remindDays = +e.target.value; Store.commit("settings"); };
    $$("#sRemCount button").forEach(b => b.onclick = () => set("reminderCount", +b.dataset.v));
    $$("[data-time]").forEach(inp => inp.onchange = () => { if (inp.value) { s.reminderTimes[+inp.dataset.time] = inp.value; s.reminderTimes = [...s.reminderTimes]; set("reminderTimes", s.reminderTimes, false); } });
    $("#sWin")?.addEventListener("click", () => set("winReminders", !s.winReminders));
    $("#sTest")?.addEventListener("click", () => {
      toast("Завтра дедлайн", "Так выглядит напоминание", "warn", "bell");
      api.notify("COMLOG: завтра дедлайн", "Тестовое напоминание — всё работает");
    });
    $("#sIcs").onclick = () => exportICS();
    $("#bExport").onclick = () => exportBackup();
    $("#bImport").onclick = () => importBackup();
    $("#bCsv").onclick = () => exportCSV();
    $("#bFolder")?.addEventListener("click", () => api.open_data_dir());
  },

  async renderAutoList() {
    const api = Store.api(), box = $("#autoList");
    try {
      let items;
      if (api) {
        $("#dataPath").textContent = "База: " + (await api.data_dir()) + "\\data.json";
        items = (await api.list_autobackups()).map(f => {
          const m = f.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
          return { id: f, label: m ? `${+m[3]} ${MONTHS_GEN[+m[2] - 1]} ${m[1]}, ${m[4]}:${m[5]}` : f };
        });
      } else {
        items = (await Store.webSnapshots()).map((x, i) => ({ id: i, label: new Date(x.ts).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) }));
      }
      box.innerHTML = items.length ? items.map(x => `<div class="auto-item"><span>${x.label}</span><button class="btn sm ghost" data-auto="${esc(x.id)}">Восстановить</button></div>`).join("")
        : `<div class="muted">Копий пока нет — появятся при следующем запуске</div>`;
      $$("#autoList [data-auto]").forEach(b => b.onclick = async () => {
        if (!await confirmBox("Восстановить автокопию?", "Текущие данные будут заменены. Если сомневаетесь, сначала сохраните бэкап.", "Восстановить", true)) return;
        const text = api ? await api.restore_autobackup(b.dataset.auto) : (await Store.webSnapshots())[+b.dataset.auto].text;
        Store.replaceAll(JSON.parse(text));
        toast("Данные восстановлены", b.closest(".auto-item").firstElementChild.textContent);
      });
    } catch (e) { console.error(e); box.innerHTML = `<div class="muted">Не удалось прочитать список</div>`; }
  },

  renderSync() {
    const box = $("#syncBox");
    if (!box) return;
    const c = Store.local.sync;
    if (!c) {
      box.innerHTML = `
        <h3>${icon("sync")}Синхронизация ПК ↔ iPhone</h3>
        <div class="muted" style="font-size:13px;margin:-6px 0 12px">Данные хранятся в вашем приватном GitHub Gist в зашифрованном виде — GitHub видит только шифр.</div>
        <div class="sync-steps">
          <div class="step"><b>На первом устройстве</b> (обычно ПК): вставьте токен GitHub с правом «gist» и создайте хранилище.
            <div class="row tight" style="margin-top:8px"><input class="field" id="syToken" type="password" placeholder="ghp_… токен GitHub" autocomplete="off"><button class="btn sm primary" id="syCreate">Создать</button></div>
            <a class="link small" href="https://github.com/settings/tokens/new?scopes=gist&description=COMLOG" target="_blank" rel="noopener">Получить токен на GitHub →</a></div>
          <div class="step"><b>На втором устройстве</b>: вставьте код подключения с первого.
            <div class="row tight" style="margin-top:8px"><input class="field" id="syCode" placeholder="COMLOG-…" autocomplete="off"><button class="btn sm" id="syConnect">Подключить</button></div></div>
        </div>`;
      $("#syCreate").onclick = async () => {
        const b = $("#syCreate"); b.disabled = true; b.textContent = "Создаю…";
        try { await Sync.create($("#syToken").value); toast("Хранилище создано", "Скопируйте код подключения для второго устройства", "ok", "sync"); }
        catch (e) { toast("Не получилось", e.message, "err", "x"); }
        this.renderSync(); Sync.render();
      };
      $("#syConnect").onclick = async () => {
        const b = $("#syConnect"); b.disabled = true; b.textContent = "Подключаю…";
        try { await Sync.connect($("#syCode").value); toast("Устройство подключено", "Данные объединены", "ok", "sync"); }
        catch (e) { toast("Не получилось", e.message, "err", "x"); }
        this.renderSync();
      };
      return;
    }
    box.innerHTML = `
      <h3>${icon("sync")}Синхронизация<span class="sub">${Sync.busy ? "идёт…" : c.error ? `<span class="red">ошибка</span>` : c.last ? "работает" : ""}</span></h3>
      <div class="sync-state ${c.error ? "err" : "ok"}">${c.error ? esc(c.error) : c.last ? `Последняя синхронизация: ${new Date(c.last).toLocaleString("ru-RU")}` : "Ещё не синхронизировано"}</div>
      <div class="set-row"><div class="sr-l"><div>Автоматически</div><div>При запуске, после изменений и раз в 3 минуты</div></div><button class="toggle ${c.auto ? "on" : ""}" id="syAuto"></button></div>
      <div class="set-row"><div class="sr-l"><div>Код подключения</div><div>Вставьте на другом устройстве. Никому не показывайте — в нём ключ к данным.</div></div><button class="btn sm" id="syCopy">${icon("copy")} Копировать</button></div>
      <div class="row wrap" style="margin-top:12px"><button class="btn sm primary" id="syNow" ${Sync.busy ? "disabled" : ""}>${icon("sync")} Синхронизировать</button><div class="spacer"></div><button class="btn sm ghost danger" id="syOff">Отключить</button></div>`;
    $("#syAuto").onclick = async () => { c.auto = !c.auto; await Store.saveLocal(); this.renderSync(); };
    $("#syCopy").onclick = async () => {
      try { await navigator.clipboard.writeText(c.code); toast("Код скопирован", "Отправьте его себе, например в «Избранное» Telegram", "ok", "copy"); }
      catch { promptBox("Код подключения", "Скопируйте вручную:", c.code); }
    };
    $("#syNow").onclick = () => Sync.run("manual");
    $("#syOff").onclick = async () => { if (await confirmBox("Отключить синхронизацию?", "Данные на этом устройстве останутся. Хранилище на GitHub тоже не удалится.", "Отключить")) Sync.disconnect(); this.renderSync(); };
  },
};

async function exportBackup() {
  const path = await saveFile(`comlog-backup-${todayISO()}.comlog`, Store.serialize());
  if (path) toast("Бэкап сохранён", path, "ok", "download");
}

async function importBackup() {
  const api = Store.api();
  let text = null, from = "";
  if (api) {
    const res = await api.import_backup();
    if (!res) return;
    if (res.error) return toast("Ошибка", res.error, "err", "x");
    text = res.text; from = res.path;
  } else {
    const f = await pickTextFile(".comlog,.json,application/json");
    if (!f) return;
    text = f.text; from = f.name;
  }
  let data;
  try { data = JSON.parse(text); if (!Array.isArray(data.orders)) throw 0; }
  catch { return toast("Ошибка", "Файл не похож на бэкап COMLOG", "err", "x"); }
  const ok = await confirmBox("Восстановить базу?", `В бэкапе ${data.orders.length} ${plural(data.orders.length, "заказ", "заказа", "заказов")}. Текущие данные будут полностью заменены.`, "Восстановить", true);
  if (!ok) return;
  Store.replaceAll(data);
  toast("База восстановлена", from);
}

async function exportCSV() {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Дата", "Клиент", "Услуга", "Прайс", "Получено", "Долг", "Выполнен", "Оплачен", "Дедлайн"]];
  [...Store.orders].sort((a, b) => a.date.localeCompare(b.date)).forEach(o =>
    rows.push([o.dateUnknown ? monthShortTitle(monthKey(o.date)) : o.date, o.client, o.service, o.price, o.received, debtOf(o), o.done ? "да" : "нет", o.paid ? "да" : "нет", o.deadline || ""]));
  const path = await saveFile(`comlog-${todayISO()}.csv`, "﻿" + rows.map(r => r.map(q).join(";")).join("\r\n"), "text/csv");
  if (path) toast("CSV сохранён", path, "ok", "table");
}
