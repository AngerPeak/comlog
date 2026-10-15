/* QR-код с кодом подключения синхронизации: показать на ПК и отсканировать камерой телефона. */
async function showQR(text) {
  try {
    await loadScript("vendor/qrcode.js");
    const qr = qrcode(0, "M");
    qr.addData(text); qr.make();
    const m = openModal(`<div class="sheet-head"><h3>${icon("qr")} Код подключения</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
      <p>На телефоне: COMLOG → Настройки → Синхронизация → «Сканировать QR-код» и наведите камеру на экран.</p>
      <div class="qr-box">${qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true })}</div>
      <div class="muted small" style="text-align:center;margin-top:10px">Никому не показывайте этот код — в нём ключ к вашим данным</div>`);
    m.querySelector("[data-x]").onclick = closeModal;
  } catch (e) { toast("Не удалось показать QR", e.message, "err", "x"); }
}

async function scanQR(onCode) {
  let stream = null, raf = 0;
  const stop = () => { cancelAnimationFrame(raf); stream?.getTracks().forEach(t => t.stop()); };
  const m = openModal(`<div class="sheet-head"><h3>${icon("qr")} Сканирование</h3><button class="icon-btn sm" data-x>${icon("x")}</button></div>
    <p>Наведите камеру на QR-код в настройках COMLOG на компьютере.</p>
    <div class="scan-box"><video playsinline muted></video><div class="scan-frame"></div></div>
    <div class="muted small" id="scanState" style="text-align:center;margin-top:10px">Запускаю камеру…</div>`);
  onModalClose = stop;
  m.querySelector("[data-x]").onclick = closeModal;
  try {
    await loadScript("vendor/jsQR.js");
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    const video = m.querySelector("video");
    video.srcObject = stream;
    await video.play();
    $("#scanState").textContent = "Ищу QR-код…";
    const c = document.createElement("canvas"), x = c.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!video.isConnected) return stop();
      if (video.readyState >= 2) {
        const w = 480, h = Math.round(w * video.videoHeight / video.videoWidth) || 360;
        c.width = w; c.height = h;
        x.drawImage(video, 0, 0, w, h);
        const code = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (code && /^COMLOG-/.test(code.data)) { closeModal(); onCode(code.data.trim()); return; }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    console.error(e);
    $("#scanState") && ($("#scanState").textContent = e.name === "NotAllowedError" ? "Нет доступа к камере — разрешите его в настройках iPhone (Safari → Камера)" : "Камера недоступна: " + (e.message || e.name));
  }
}
