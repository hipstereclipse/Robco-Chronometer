(function() {
  var appId = "ROBANALOG";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var dirty = false;
  var analogDetail = true;
  var analogStyle = 0;
  var days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  var months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  var faceNames = ["REGULATOR", "FIELD", "RELAY"];

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function wrap(n, max) {
    n = n % max;
    return n < 0 ? n + max : n;
  }

  function line(x1, y1, x2, y2) {
    screen.drawLine(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
  }

  function setMono() {
    try {
      screen.setFont("Monofonto23");
    } catch (e) {
      screen.setFontVector(18);
    }
    return screen;
  }

  function sound(id) {
    try {
      if (typeof Pip !== "undefined" && Pip.audioBuiltin) Pip.audioBuiltin(id);
    } catch (e) {
    }
  }

  function loadSettings() {
    try {
      var p = String(require("fs").readFileSync("USER/ROBANALOG.SET")).split(",");
      if (p.length >= 2) {
        analogStyle = Math.max(0, Math.min(2, p[0] | 0));
        analogDetail = p[1] !== "0";
      }
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!dirty) return;
    try {
      require("fs").writeFileSync("USER/ROBANALOG.SET", [analogStyle, analogDetail ? 1 : 0].join(","));
    } catch (e) {
    }
  }

  function drawHeader(d) {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO ANALOG", 22, 10);
    setMono().setFontAlign(1, -1).drawString(pad2(d.getHours()) + ":" + pad2(d.getMinutes()), w - 22, 10);
    screen.drawLine(18, 38, w - 18, 38);
    setMono().setFontAlign(0, -1).drawString("ANALOG", w / 2, 42);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    var y = hgt - 32;
    screen.setColor(1);
    screen.drawLine(18, y - 8, w - 18, y - 8);
    setMono().setFontAlign(-1, -1).drawString("K1 FACE/DATA", 22, y);
    setMono().setFontAlign(1, -1).drawString("K2 FACE", w - 22, y);
  }

  function drawHand(cx, cy, angle, len) {
    line(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  }

  function drawNeedle(cx, cy, angle, len, tail, wide) {
    var x = Math.cos(angle);
    var y = Math.sin(angle);
    line(cx - (x * tail), cy - (y * tail), cx + (x * len), cy + (y * len));
    if (wide) {
      line(cx - (y * 3), cy + (x * 3), cx + (x * (len - 10)), cy + (y * (len - 10)));
      line(cx + (y * 3), cy - (x * 3), cx + (x * (len - 10)), cy + (y * (len - 10)));
    }
  }

  function drawTick(cx, cy, a, inner, outer) {
    line(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
  }

  function drawCardinals(cx, cy, r, style) {
    screen.setColor(style === 1 ? 3 : 1);
    if (style === 2) {
      setMono().setFontAlign(0, 0).drawString("XII", cx, cy - r + 29);
      setMono().setFontAlign(0, 0).drawString("III", cx + r - 31, cy);
      setMono().setFontAlign(0, 0).drawString("VI", cx, cy + r - 29);
      setMono().setFontAlign(0, 0).drawString("IX", cx - r + 31, cy);
    } else {
      setMono().setFontAlign(0, 0).drawString("12", cx, cy - r + 29);
      setMono().setFontAlign(0, 0).drawString("3", cx + r - 31, cy);
      setMono().setFontAlign(0, 0).drawString("6", cx, cy + r - 29);
      setMono().setFontAlign(0, 0).drawString("9", cx - r + 31, cy);
    }
  }

  function drawFace(cx, cy, r) {
    var i;
    screen.setColor(3);
    screen.drawCircle(cx, cy, r);
    screen.drawCircle(cx, cy, r - (analogStyle === 1 ? 12 : 6));
    if (analogStyle === 1) {
      screen.setColor(1);
      screen.drawCircle(cx, cy, r - 30);
      line(cx - r + 18, cy, cx + r - 18, cy);
      line(cx, cy - r + 18, cx, cy + r - 18);
    } else if (analogStyle === 2) {
      screen.setColor(1);
      screen.drawCircle(cx, cy, r - 18);
      screen.drawCircle(cx, cy, r - 42);
      line(cx - 18, cy, cx + 18, cy);
      line(cx, cy - 18, cx, cy + 18);
    }
    for (i = 0; i < 60; i++) {
      var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var major = i % 5 === 0;
      if (analogStyle === 1 && !major) continue;
      var quarter = i % 15 === 0;
      var r1 = r - (quarter ? 21 : (major ? 15 : 7));
      var r2 = r - (analogStyle === 1 && quarter ? 1 : 3);
      screen.setColor(major ? 3 : 1);
      drawTick(cx, cy, a, r1, r2);
      if (analogStyle === 2 && major) drawTick(cx, cy, a, r - 31, r - 25);
    }
    drawCardinals(cx, cy, r, analogStyle);
  }

  function draw() {
    if (!screen) return;
    var d = new Date();
    var cx = 150, cy = 162, r = 100;
    var h = d.getHours() % 12;
    var m = d.getMinutes();
    var s = d.getSeconds();
    drawHeader(d);
    drawFace(cx, cy, r);
    screen.setColor(3);
    drawNeedle(cx, cy, (((h + (m / 60)) / 12) * Math.PI * 2) - Math.PI / 2, 50, 10, true);
    drawNeedle(cx, cy, (((m + (s / 60)) / 60) * Math.PI * 2) - Math.PI / 2, 76, 14, analogStyle !== 1);
    screen.setColor(1);
    drawNeedle(cx, cy, ((s / 60) * Math.PI * 2) - Math.PI / 2, 88, 18, false);
    screen.drawCircle(cx, cy, 4);
    screen.drawRect(274, 76, 438, 250);
    line(286, 90, 426, 90);
    line(286, 232, 426, 232);
    setMono().setFontAlign(0, -1).drawString("VAULT-TEC", 356, 98);
    setMono().setFontAlign(0, -1).drawString("CERTIFIED DATE", 356, 122);
    if (analogDetail) {
      screen.setColor(3);
      setMono().setFontAlign(0, -1).drawString(days[d.getDay()], 356, 156);
      setMono().setFontAlign(0, -1).drawString(months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(), 356, 184);
      screen.setColor(1);
      setMono().setFontAlign(0, -1).drawString(faceNames[analogStyle] + " OK", 356, 214);
    } else {
      setMono().setFontAlign(0, -1).drawString("DATE REDACTED", 356, 166);
      setMono().setFontAlign(0, -1).drawString(faceNames[analogStyle], 356, 198);
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
    if (dir === 0) analogDetail = !analogDetail;
    else analogStyle = wrap(analogStyle + dir, 3);
    dirty = true;
    sound("CLICK");
    safeDraw();
  }

  function onKnob2(dir) {
    if (dir !== 0) analogStyle = wrap(analogStyle + dir, 3);
    dirty = true;
    sound("CLICK");
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
