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
    var c = Math.floor((ms % 1000) / 10);
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) + "." + pad2(c) : pad2(m) + ":" + pad2(s) + "." + pad2(c);
  }

  function drawActivity(ms) {
    var i;
    var x = 88;
    var y = 184;
    screen.setColor(1);
    screen.drawRect(x - 8, y - 8, x + 308, y + 8);
    for (i = 0; i < 10; i++) {
      if (i <= Math.floor((ms % 1000) / 100)) screen.setColor(3);
      else screen.setColor(1);
      screen.drawLine(x + (i * 30), y, x + (i * 30) + 20, y);
    }
  }

  function drawHeader() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO STOPWATCH", 22, 10);
    setMono().setFontAlign(1, -1).drawString("FIELD TEST", w - 22, 10);
    screen.drawLine(18, 38, w - 18, 38);
    setMono().setFontAlign(0, -1).drawString("STOPWATCH", w / 2, 42);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var h = screen.getHeight ? screen.getHeight() : 320;
    var y = h - 32;
    screen.setColor(1);
    screen.drawLine(18, y - 8, w - 18, y - 8);
    setMono().setFontAlign(-1, -1).drawString("K1 START/LAP", 22, y);
    setMono().setFontAlign(1, -1).drawString("K2 RESET", w - 22, y);
  }

  function draw() {
    if (!screen) return;
    var ms = stopwatchMs();
    drawHeader();
    screen.setColor(3);
    setVector(ms >= 3600000 ? 42 : 64).setFontAlign(0, 0).drawString(formatMs(ms), 238, 126);
    drawActivity(ms);
    setMono().setFontAlign(0, -1).drawString(running ? "FIELD TEST RUNNING" : "FIELD TEST STANDBY", 238, 204);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(lap >= 0 ? "LAP  " + formatMs(lap) : "LAP  --:--.--", 238, 232);
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
  ticker = setInterval(safeDraw, 16);
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
