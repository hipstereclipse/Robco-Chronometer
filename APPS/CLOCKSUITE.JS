(function() {
  var appId = "ROBCLOCK";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var dirty = false;
  var clockLayout = 1;
  var showSeconds = true;
  var hour24 = true;
  var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var layouts = ["TIME", "DATE", "FIELD", "VAULT"];

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function wrap(n, max) {
    n = n % max;
    return n < 0 ? n + max : n;
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

  function formatTime(d, secs) {
    var h = d.getHours();
    var suffix = "";
    if (!hour24) {
      suffix = h >= 12 ? " PM" : " AM";
      h = h % 12;
      if (h === 0) h = 12;
    }
    return pad2(h) + ":" + pad2(d.getMinutes()) + (secs ? ":" + pad2(d.getSeconds()) : "") + suffix;
  }

  function formatDate(d) {
    return days[d.getDay()] + " " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatOffset() {
    var d = new Date();
    var m = d.getTimezoneOffset ? -d.getTimezoneOffset() : 0;
    if (m === 0) return "UTC";
    return "UTC" + (m > 0 ? "+" : "-") + pad2(Math.floor(Math.abs(m) / 60)) + ":" + pad2(Math.abs(m) % 60);
  }

  function loadSettings() {
    try {
      var p = String(require("fs").readFileSync("USER/ROBCLOCK.SET")).split(",");
      if (p.length >= 3) {
        clockLayout = Math.max(0, Math.min(3, p[0] | 0));
        showSeconds = p[1] !== "0";
        hour24 = p[2] !== "0";
      }
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!dirty) return;
    try {
      require("fs").writeFileSync("USER/ROBCLOCK.SET", [clockLayout, showSeconds ? 1 : 0, hour24 ? 1 : 0].join(","));
    } catch (e) {
    }
  }

  function drawHeader(d) {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO CLOCK", 22, 10);
    setMono().setFontAlign(1, -1).drawString(formatTime(d, false), w - 22, 10);
    screen.drawLine(18, 38, w - 18, 38);
    setMono().setFontAlign(0, -1).drawString(layouts[clockLayout], w / 2, 42);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    var y = hgt - 32;
    screen.setColor(1);
    screen.drawLine(18, y - 8, w - 18, y - 8);
    setMono().setFontAlign(-1, -1).drawString("K1 LAYOUT/SEC", 22, y);
    setMono().setFontAlign(1, -1).drawString("K2 12H/24H", w - 22, y);
  }

  function drawRail() {
    screen.setColor(1);
    screen.drawRect(326, 78, 468, 232);
    setMono().setFontAlign(0, -1).drawString("DISPLAY", 397, 86);
    setMono().setFontAlign(-1, -1).drawString("LAYOUT " + layouts[clockLayout], 336, 116);
    setMono().setFontAlign(-1, -1).drawString("SECS " + (showSeconds ? "ON" : "OFF"), 336, 140);
    setMono().setFontAlign(-1, -1).drawString("FMT " + (hour24 ? "24H" : "12H"), 336, 164);
    setMono().setFontAlign(-1, -1).drawString("SIGNAL OK", 336, 188);
  }

  function draw() {
    if (!screen) return;
    var d = new Date();
    var w = screen.getWidth ? screen.getWidth() : 480;
    drawHeader(d);
    screen.setColor(3);
    if (clockLayout === 0) {
      setVector(showSeconds ? 54 : 72).setFontAlign(0, 0).drawString(formatTime(d, showSeconds), w / 2, 145);
      setMono().setFontAlign(0, -1).drawString("VAULT-TEC LOCAL TIME", w / 2, 215);
    } else {
      setVector(showSeconds ? 46 : 62).setFontAlign(0, 0).drawString(formatTime(d, showSeconds), 172, 132);
      setMono().setFontAlign(0, -1).drawString(formatDate(d), 172, 180);
      if (clockLayout >= 2) {
        screen.setColor(1);
        setMono().setFontAlign(0, -1).drawString("PIP-BOY RTC  " + formatOffset(), 172, 210);
      }
      if (clockLayout >= 3) {
        setMono().setFontAlign(0, -1).drawString("VAULT STATUS: NOMINAL", 172, 236);
      }
      drawRail();
    }
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      draw();
    } catch (e) {
    }
  }

  function onKnob1(dir) {
    if (dir === 0) showSeconds = !showSeconds;
    else clockLayout = wrap(clockLayout + dir, layouts.length);
    dirty = true;
    sound("CLICK");
    safeDraw();
  }

  function onKnob2(dir) {
    if (dir === 0) hour24 = !hour24;
    else clockLayout = wrap(clockLayout + dir, layouts.length);
    dirty = true;
    sound("OK");
    safeDraw();
  }

  loadSettings();
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
      saveSettings();
      if (typeof Pip !== "undefined") {
        Pip.removeListener("knob1", onKnob1);
        Pip.removeListener("knob2", onKnob2);
      }
    }
  };
})
