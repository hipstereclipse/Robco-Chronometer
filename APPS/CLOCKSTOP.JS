(function() {
  var appId = "ROBSTOP";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker = null;
  var running = false;
  var start = 0;
  var elapsed = 0;
  var lap = -1;
  // While running we redraw often enough for hundredths to visibly update, but
  // not so often that the Espruino event loop is flooded on-device.
  var FAST_MS = 50;
  // Inset for content near the rounded-corner bezel (see header/footer).
  var MARGIN = 32;

  function nowMs() {
    return (new Date()).getTime();
  }

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function setMono() {
    try {
      screen.setFont("Monofonto23");
    } catch (e) {
      screen.setFontVector(18);
    }
    return screen;
  }

  function setVector(size) {
    try {
      screen.setFontVector(size);
    } catch (e) {
      setMono();
    }
    return screen;
  }

  function sound(id) {
    try {
      if (typeof Pip !== "undefined" && Pip.audioBuiltin) Pip.audioBuiltin(id);
    } catch (e) {
    }
  }

  function stopwatchMs() {
    return elapsed + (running ? nowMs() - start : 0);
  }

  function formatMs(ms) {
    ms = Math.max(0, Math.floor(ms));
    var total = Math.floor(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var cs = Math.floor((ms % 1000) / 10);
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s) + "." + pad2(cs);
  }

  function fillBar(x0, y0, x1, y1) {
    var y;
    for (y = y0; y <= y1; y++) screen.drawLine(x0, y, x1, y);
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    screen.drawRect(22, 6, w - 23, hgt - 8);
    screen.drawLine(22, 34, w - 23, 34);
    screen.drawLine(22, 58, w - 23, 58);
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO INDUSTRIES (TM)", MARGIN, 8);
    setMono().setFontAlign(1, -1).drawString("FIELD TEST", w - MARGIN, 8);
    screen.setColor(1);
    setMono().setFontAlign(-1, -1).drawString("TERMLINK TIMER", MARGIN, 36);
    setMono().setFontAlign(1, -1).drawString("STOPWATCH", w - MARGIN, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(22, hgt - 34, w - 23, hgt - 34);
    setMono().setFontAlign(-1, -1).drawString("K1 START/LAP", MARGIN, hgt - 24);
    setMono().setFontAlign(1, -1).drawString("K2 RESET", w - MARGIN, hgt - 24);
  }

  function draw() {
    if (!screen) return;
    var w = screen.getWidth ? screen.getWidth() : 480;
    var ms = stopwatchMs();
    var cx = w / 2;
    drawHeader();
    screen.setColor(1);
    screen.drawRect(58, 76, w - 58, 254);
    screen.drawLine(58, 178, w - 58, 178);
    // Main elapsed time.
    screen.setColor(3);
    setVector(60).setFontAlign(0, 0).drawString(formatMs(ms), cx, 122);
    // Sub-second sweep bar (fills 0..1.0 each second) — visualises the live refresh.
    var barX0 = cx - 150, barX1 = cx + 150, barY = 168;
    var frac = (ms % 1000) / 1000;
    screen.setColor(1);
    screen.drawRect(barX0, barY, barX1, barY + 9);
    if (running) {
      screen.setColor(3);
      fillBar(barX0 + 2, barY + 2, barX0 + 2 + Math.round((barX1 - barX0 - 4) * frac), barY + 7);
    }
    // Status.
    screen.setColor(running ? 3 : 1);
    setMono().setFontAlign(0, -1).drawString(running ? "PROTOCOL RUNNING" : "PROTOCOL HALTED", cx, 192);
    // Lap.
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(lap >= 0 ? "ADDR 0xF4F0  LAP " + formatMs(lap) : "ADDR 0xF4F0  LAP --:--.--", cx, 224);
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      draw();
    } catch (e) {
    }
  }

  function applyRate() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
    if (running) ticker = setInterval(safeDraw, FAST_MS);
  }

  function toggle() {
    if (running) {
      elapsed = stopwatchMs();
      running = false;
    } else {
      start = nowMs();
      running = true;
    }
    applyRate();
    sound("OK");
    safeDraw();
  }

  function reset() {
    running = false;
    start = 0;
    elapsed = 0;
    lap = -1;
    applyRate();
    sound("PREV");
    safeDraw();
  }

  function onKnob1(dir) {
    dir = dir | 0;
    if (dir === 0) {
      toggle();
    } else if (running) {
      lap = stopwatchMs();
      sound("CLICK");
      safeDraw();
    } else {
      reset();
    }
  }

  function onKnob2(dir) {
    dir = dir | 0;
    reset();
  }

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", onKnob1);
    Pip.on("knob2", onKnob2);
  }
  safeDraw();

  return {
    id: appId,
    notDefault: true,
    fullscreen: true,
    remove: function() {
      if (ticker) clearInterval(ticker);
      if (typeof Pip !== "undefined") {
        Pip.removeListener("knob1", onKnob1);
        Pip.removeListener("knob2", onKnob2);
      }
    }
  };
})
