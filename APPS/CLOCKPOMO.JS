(function() {
  var appId = "ROBPOMO";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  // Inset for content near the rounded-corner bezel so nothing is clipped.
  var MARGIN = 32;
  var workSeconds = 25 * 60;
  var breakSeconds = 5 * 60;
  var phase = 0;
  var remaining = workSeconds;
  var running = false;
  var endTime = 0;
  var cycles = 0;
  var stepIndex = 4;
  var stepValues = [1, 5, 15, 30, 60, 300];
  var stepLabels = ["1S", "5S", "15S", "30S", "1M", "5M"];

  function nowMs() {
    return (new Date()).getTime();
  }

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function wrap(n, max) {
    n = n % max;
    return n < 0 ? n + max : n;
  }

  function stepSeconds() {
    return stepValues[stepIndex];
  }

  function stepLabel() {
    return stepLabels[stepIndex];
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

  function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s);
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

  function drawProgress(x0, y0, x1, y1, frac) {
    frac = Math.max(0, Math.min(1, frac));
    screen.setColor(1);
    screen.drawRect(x0, y0, x1, y1);
    if (frac > 0) {
      screen.setColor(3);
      fillBar(x0 + 2, y0 + 2, x0 + 2 + Math.round((x1 - x0 - 4) * frac), y1 - 2);
    }
  }

  function current() {
    if (!running) return remaining;
    return Math.max(0, Math.ceil((endTime - nowMs()) / 1000));
  }

  function nextPhase(autoStart) {
    if (phase === 0) {
      cycles++;
      phase = 1;
      remaining = breakSeconds;
    } else {
      phase = 0;
      remaining = workSeconds;
    }
    running = !!autoStart;
    if (running) endTime = nowMs() + (remaining * 1000);
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var h = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    screen.drawLine(MARGIN, 42, w - MARGIN, 42);
    screen.drawLine(MARGIN, 66, w - MARGIN, 66);
    screen.setColor(3);
    setVector(15);
    drawFit("ROBCO TERMLINK", MARGIN, 12, 210, -1);
    drawFit(phase === 0 ? "WORK" : "BREAK", w - MARGIN, 12, 130, 1);
    drawFit("> WORK CYCLE REGULATOR", MARGIN, 47, 282, -1);
    screen.setColor(1);
    drawFit(phase === 0 ? "WORK" : "BREAK", w - MARGIN, 47, 152, 1);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var h = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(MARGIN, h - 40, w - MARGIN, h - 40);
    setVector(14);
    drawFit("K1 START/ADJ", MARGIN, h - 31, 210, -1);
    drawFit("K2 STEP/RST", w - MARGIN, h - 31, 210, 1);
  }

  function draw() {
    if (!screen) return;
    var phaseName = phase === 0 ? "WORK RATION" : "RECOVERY";
    var total = phase === 0 ? workSeconds : breakSeconds;
    var cur = current();
    drawHeader();
    screen.setColor(1);
    screen.drawRect(58, 78, 420, 256);
    screen.drawLine(58, 178, 420, 178);
    setMono();
    drawFit("ADDR 0xBEEF // CYCLE CORE", 238, 86, 340, 0);
    screen.setColor(3);
    drawVectorFit(formatDuration(cur), 238, 124, 340, 64, 36, 0);
    drawProgress(94, 164, 386, 173, total ? cur / total : 0);
    screen.setColor(3);
    setMono();
    drawFit(phaseName + (running ? " ACTIVE" : " READY"), 238, 190, 340, 0);
    screen.setColor(1);
    setMono();
    drawFit("CYCLES " + cycles + "  INCREMENT " + stepLabel(), 238, 216, 340, 0);
    drawFit("WORK " + formatDuration(workSeconds) + "  BREAK " + formatDuration(breakSeconds), 238, 238, 340, 0);
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      if (running && current() <= 0) {
        sound("OK2");
        nextPhase(true);
      }
      draw();
    } catch (e) {
    }
  }

  function toggle() {
    if (running) {
      remaining = current();
      running = false;
    } else {
      if (remaining <= 0) remaining = phase === 0 ? workSeconds : breakSeconds;
      endTime = nowMs() + (remaining * 1000);
      running = true;
    }
    sound("OK");
    safeDraw();
  }

  function reset() {
    running = false;
    phase = 0;
    remaining = workSeconds;
    cycles = 0;
    sound("PREV");
    safeDraw();
  }

  function onKnob1(dir) {
    dir = dir | 0;
    if (dir === 0) {
      toggle();
    } else if (!running) {
      if (phase === 0) {
        workSeconds = clamp(workSeconds + (dir * stepSeconds()), 5 * 60, 60 * 60);
        remaining = workSeconds;
      } else {
        breakSeconds = clamp(breakSeconds + (dir * stepSeconds()), 60, 30 * 60);
        remaining = breakSeconds;
      }
      sound("CLICK");
      safeDraw();
    }
  }

  function onKnob2(dir) {
    dir = dir | 0;
    if (dir === 0) {
      reset();
    } else {
      stepIndex = wrap(stepIndex + dir, stepValues.length);
      sound("CLICK");
      safeDraw();
    }
  }

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", onKnob1);
    Pip.on("knob2", onKnob2);
  }
  ticker = setInterval(safeDraw, 1000);
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
