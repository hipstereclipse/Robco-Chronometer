(function() {
  var appId = "ROBANALOG";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var dirty = false;
  var analogDetail = true;
  var analogStyle = 0;
  // Inset for content anchored near the screen's rounded corners so nothing is
  // clipped by the bezel. Anything at x < MARGIN or x > w - MARGIN risks the arc.
  var MARGIN = 32;
  var styleNames = ["CHRONO", "FIELD", "RANGER"];
  var days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  var months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

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
    setMono().setFontAlign(-1, -1).drawString("ROBCO ANALOG", MARGIN, 8);
    setMono().setFontAlign(1, -1).drawString(pad2(d.getHours()) + ":" + pad2(d.getMinutes()), w - MARGIN, 8);
    screen.drawLine(0, 32, w, 32);
    setMono().setFontAlign(0, -1).drawString(styleNames[analogStyle], w / 2, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(0, hgt - 32, w, hgt - 32);
    setMono().setFontAlign(-1, -1).drawString("K1 FACE/DATA", MARGIN, hgt - 24);
    setMono().setFontAlign(1, -1).drawString("K2 FACE", w - MARGIN, hgt - 24);
  }

  // A solid, slightly-filled hub built from concentric circles (no fillCircle).
  function hub(cx, cy, r) {
    var i;
    for (i = 0; i <= r; i++) screen.drawCircle(cx, cy, i);
  }

  // A weighted hand: a constant-width shaft (built from parallel lines) that
  // tapers to a point at the tip, with a short counterbalance tail.
  function hand(cx, cy, angle, len, back, halfW) {
    var ca = Math.cos(angle), sa = Math.sin(angle);
    var nx = -sa, ny = ca;
    var shoulder = len - Math.max(8, halfW * 4);
    var tx = cx + ca * len, ty = cy + sa * len;
    var o;
    for (o = -halfW; o <= halfW; o += 0.5) {
      var bx = cx + nx * o - ca * back, by = cy + ny * o - sa * back;
      var sx = cx + nx * o + ca * shoulder, sy = cy + ny * o + sa * shoulder;
      line(bx, by, sx, sy);
      line(sx, sy, tx, ty);
    }
  }

  function tickRing(cx, cy, r, minorPips) {
    var i;
    for (i = 0; i < 60; i++) {
      var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var major = i % 5 === 0;
      if (!major && !minorPips) continue;
      var ca = Math.cos(a), sa = Math.sin(a);
      var inner = r - (major ? 15 : 6);
      var outer = r - 3;
      screen.setColor(major ? 3 : 1);
      line(cx + ca * inner, cy + sa * inner, cx + ca * outer, cy + sa * outer);
      if (major) {
        // thicken major ticks with a second offset stroke
        line(cx + ca * inner - sa, cy + sa * inner + ca, cx + ca * outer - sa, cy + sa * outer + ca);
      }
    }
  }

  function hourDots(cx, cy, r) {
    var i;
    screen.setColor(1);
    for (i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      screen.drawCircle(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8), 2);
    }
  }

  function numerals(cx, cy, r, cardinalsOnly) {
    var i;
    for (i = 1; i <= 12; i++) {
      var cardinal = (i % 3 === 0);
      if (cardinalsOnly && !cardinal) continue;
      var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      var rn = r - 22;
      screen.setColor(cardinal ? 3 : 1);
      setVector(cardinal ? 23 : 18).setFontAlign(0, 0).drawString("" + i, cx + Math.cos(a) * rn, cy + Math.sin(a) * rn);
    }
  }

  function drawFace(cx, cy, r) {
    screen.setColor(3);
    screen.drawCircle(cx, cy, r);
    if (analogStyle === 0) {
      screen.drawCircle(cx, cy, r - 4);
      tickRing(cx, cy, r, true);
      numerals(cx, cy, r, false);
    } else if (analogStyle === 1) {
      tickRing(cx, cy, r, true);
      hourDots(cx, cy, r);
    } else {
      screen.drawCircle(cx, cy, r - 4);
      tickRing(cx, cy, r, false);
      numerals(cx, cy, r, true);
      hourDots(cx, cy, r);
    }
  }

  function drawHands(cx, cy, h, m, s) {
    var hourA = (((h + (m / 60)) / 12) * Math.PI * 2) - Math.PI / 2;
    var minA = (((m + (s / 60)) / 60) * Math.PI * 2) - Math.PI / 2;
    var secA = ((s / 60) * Math.PI * 2) - Math.PI / 2;
    screen.setColor(3);
    hand(cx, cy, hourA, 52, 14, 3);
    hand(cx, cy, minA, 78, 16, 2);
    screen.setColor(1);
    // second hand: thin shaft with a long counterbalance tail and a tip ring
    line(cx - Math.cos(secA) * 22, cy - Math.sin(secA) * 22, cx + Math.cos(secA) * 88, cy + Math.sin(secA) * 88);
    screen.drawCircle(cx + Math.cos(secA) * 70, cy + Math.sin(secA) * 70, 3);
    screen.setColor(3);
    hub(cx, cy, 4);
  }

  function drawPanel() {
    screen.setColor(1);
    screen.drawRect(274, 70, 446, 256);
    line(274, 96, 446, 96);
    setMono().setFontAlign(0, -1).drawString("VAULT-TEC CHRONO", 360, 76);
  }

  function draw() {
    if (!screen) return;
    var d = new Date();
    var cx = 158, cy = 168, r = 96;
    var h = d.getHours() % 12;
    var m = d.getMinutes();
    var s = d.getSeconds();
    drawHeader(d);
    drawFace(cx, cy, r);
    drawHands(cx, cy, h, m, s);
    drawPanel();
    if (analogDetail) {
      screen.setColor(3);
      setVector(28).setFontAlign(0, 0).drawString(pad2(d.getHours()) + ":" + pad2(m) + ":" + pad2(s), 360, 130);
      setMono().setFontAlign(0, -1).drawString(days[d.getDay()], 360, 158);
      screen.setColor(1);
      setMono().setFontAlign(0, -1).drawString(months[d.getMonth()] + " " + d.getDate(), 360, 188);
      setMono().setFontAlign(0, -1).drawString("" + d.getFullYear(), 360, 214);
      setMono().setFontAlign(0, -1).drawString("FACE " + styleNames[analogStyle], 360, 238);
    } else {
      screen.setColor(1);
      setMono().setFontAlign(0, -1).drawString("DATE PANEL OFF", 360, 150);
      setMono().setFontAlign(0, -1).drawString("FACE " + styleNames[analogStyle], 360, 188);
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
    analogStyle = wrap(analogStyle + (dir || 1), 3);
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
