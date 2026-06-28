(function() {
  var appId = "ROBCOUNT";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var setSeconds = 5 * 60;
  var remaining = setSeconds;
  var running = false;
  var endTime = 0;

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

  function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s);
  }

  function current() {
    if (!running) return remaining;
    return Math.max(0, Math.ceil((endTime - nowMs()) / 1000));
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO COUNTDOWN", 8, 6);
    setMono().setFontAlign(1, -1).drawString("RADSAFE", w - 8, 6);
    screen.drawLine(0, 32, w, 32);
    setMono().setFontAlign(0, -1).drawString("COUNTDOWN", w / 2, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var h = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(0, h - 29, w, h - 29);
    setMono().setFontAlign(-1, -1).drawString("K1 START/ADJ", 8, h - 22);
    setMono().setFontAlign(1, -1).drawString("K2 RESET", w - 8, h - 22);
  }

  function draw() {
    if (!screen) return;
    drawHeader();
    screen.setColor(3);
    setVector(64).setFontAlign(0, 0).drawString(formatDuration(current()), 238, 130);
    setMono().setFontAlign(0, -1).drawString(running ? "RADSAFE COUNTDOWN ACTIVE" : "SET " + formatDuration(setSeconds), 238, 196);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString("ADJUSTMENT: ONE MINUTE STEPS", 238, 230);
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      if (running && current() <= 0) {
        running = false;
        remaining = 0;
        sound("OK2");
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
      if (remaining <= 0) remaining = setSeconds;
      endTime = nowMs() + (remaining * 1000);
      running = true;
    }
    sound("OK");
    safeDraw();
  }

  function reset() {
    running = false;
    remaining = setSeconds;
    sound("PREV");
    safeDraw();
  }

  function onKnob1(dir) {
    if (dir === 0) {
      toggle();
    } else if (!running) {
      setSeconds = clamp(setSeconds + (dir * 60), 60, 99 * 60);
      remaining = setSeconds;
      sound("CLICK");
      safeDraw();
    }
  }

  function onKnob2(dir) {
    reset();
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
