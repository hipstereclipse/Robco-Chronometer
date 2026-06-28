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
  var FAST_MS = 40;
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

  function textWidth(text) {
    text = String(text);
    try {
      if (screen.stringWidth) return screen.stringWidth(text);
    } catch (e) {
    }
    return text.length * 12;
  }

  function fitText(text, maxW) {
    text = String(text);
    while (text.length > 0 && textWidth(text) > maxW) text = text.substring(0, text.length - 1);
    return text;
  }

  function drawFit(text, x, y, maxW, align) {
    screen.setFontAlign(align, -1).drawString(fitText(text, maxW), x, y);
  }

  function drawVectorFit(text, x, y, maxW, maxSize, minSize, yAlign) {
    var size;
    text = String(text);
    for (size = maxSize; size >= minSize; size -= 2) {
      setVector(size);
      if (textWidth(text) <= maxW) break;
    }
    screen.setFontAlign(0, yAlign).drawString(text, x, y);
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

  // Beveled HUD frame: the cut corners trace the device's rounded bezel so the
  // border reads as a natural panel instead of a hard rectangle.
  function frame(x1, y1, x2, y2, c) {
    screen.drawLine(x1 + c, y1, x2 - c, y1);
    screen.drawLine(x2 - c, y1, x2, y1 + c);
    screen.drawLine(x2, y1 + c, x2, y2 - c);
    screen.drawLine(x2, y2 - c, x2 - c, y2);
    screen.drawLine(x2 - c, y2, x1 + c, y2);
    screen.drawLine(x1 + c, y2, x1, y2 - c);
    screen.drawLine(x1, y2 - c, x1, y1 + c);
    screen.drawLine(x1, y1 + c, x1 + c, y1);
  }

  function drawScanlines(w, hgt) {
    var y;
    screen.setColor(1);
    for (y = 76; y < hgt - 44; y += 8) screen.drawLine(36, y, w - 37, y);
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    screen.drawLine(MARGIN, 42, w - MARGIN, 42);
    screen.drawLine(MARGIN, 66, w - MARGIN, 66);
    screen.setColor(3);
    setVector(15);
    drawFit("ROBCO TERMLINK", MARGIN, 12, 210, -1);
    drawFit("FIELD TEST", w - MARGIN, 12, 130, 1);
    drawFit("> PRECISION FIELD TIMER", MARGIN, 47, 282, -1);
    screen.setColor(1);
    drawFit("STOPWATCH", w - MARGIN, 47, 152, 1);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(MARGIN, hgt - 40, w - MARGIN, hgt - 40);
    setVector(14);
    drawFit("K1 START/LAP", MARGIN, hgt - 31, 200, -1);
    drawFit("K2 RESET", w - MARGIN, hgt - 31, 200, 1);
  }

  function draw() {
    if (!screen) return;
    var w = screen.getWidth ? screen.getWidth() : 480;
    var ms = stopwatchMs();
    var cx = w / 2;
    drawHeader();
    screen.setColor(1);
    screen.drawRect(58, 78, w - 58, 256);
    screen.drawLine(58, 176, w - 58, 176);
    setMono();
    drawFit("ADDR 0xF4F0 // ELAPSED", cx, 80, w - 136, 0);
    // Main elapsed time. Capped well below the header label and sweep bar so the
    // large readout can't ride up over them, and smaller glyphs render faster
    // (vector fill cost scales with size) for a smoother running redraw.
    screen.setColor(3);
    drawVectorFit(formatMs(ms), cx, 130, w - 136, 44, 30, 0);
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
    setMono();
    drawFit(running ? "PROTOCOL RUNNING" : "PROTOCOL HALTED", cx, 192, w - 136, 0);
    // Lap.
    screen.setColor(1);
    setMono();
    drawFit(lap >= 0 ? "ADDR 0xF4F0  LAP " + formatMs(lap) : "ADDR 0xF4F0  LAP --:--.--", cx, 224, w - 136, 0);
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
