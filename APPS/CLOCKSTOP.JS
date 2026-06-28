(function() {
  var appId = "ROBSTOP";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var running = false;
  var start = 0;
  var elapsed = 0;
  var lap = -1;

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
    var t = Math.floor((ms % 1000) / 100);
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s) + "." + t;
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO STOPWATCH", 8, 6);
    setMono().setFontAlign(1, -1).drawString("FIELD TEST", w - 8, 6);
    screen.drawLine(0, 32, w, 32);
    setMono().setFontAlign(0, -1).drawString("STOPWATCH", w / 2, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var h = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(0, h - 29, w, h - 29);
    setMono().setFontAlign(-1, -1).drawString("K1 START/LAP", 8, h - 22);
    setMono().setFontAlign(1, -1).drawString("K2 RESET", w - 8, h - 22);
  }

  function draw() {
    if (!screen) return;
    drawHeader();
    screen.setColor(3);
    setVector(58).setFontAlign(0, 0).drawString(formatMs(stopwatchMs()), 238, 130);
    setMono().setFontAlign(0, -1).drawString(running ? "FIELD TEST RUNNING" : "FIELD TEST STOPPED", 238, 190);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(lap >= 0 ? "LAP  " + formatMs(lap) : "LAP  --:--.-", 238, 224);
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      draw();
    } catch (e) {
    }
  }

  function toggle() {
    if (running) {
      elapsed = stopwatchMs();
      running = false;
    } else {
      start = nowMs();
      running = true;
    }
    sound("OK");
    safeDraw();
  }

  function reset() {
    running = false;
    start = 0;
    elapsed = 0;
    lap = -1;
    sound("PREV");
    safeDraw();
  }

  function onKnob1(dir) {
    if (dir === 0) toggle();
    else if (running) {
      lap = stopwatchMs();
      sound("CLICK");
      safeDraw();
    } else {
      reset();
    }
  }

  function onKnob2(dir) {
    if (dir === 0 || dir !== 0) reset();
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
