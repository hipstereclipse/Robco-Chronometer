(function() {
  var appId = "ROBANALOG";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var dirty = false;
  var analogDetail = true;
  var analogStyle = 0;
  var locked = false;
  // Inset for content anchored near the screen's rounded corners so nothing is
  // clipped by the bezel. Anything at x < MARGIN or x > w - MARGIN risks the arc.
  var MARGIN = 32;
  var styleNames = ["CHRONO", "FIELD", "RANGER", "VAULT", "RADIAL", "RELAY"];
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

  function loadSettings() {
    try {
      var p = String(require("fs").readFileSync("USER/ROBANALOG.SET")).split(",");
      if (p.length >= 2) {
        analogStyle = Math.max(0, Math.min(styleNames.length - 1, p[0] | 0));
        analogDetail = p[1] !== "0";
      }
      if (p.length >= 3) locked = p[2] !== "0";
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!dirty) return;
    try {
      require("fs").writeFileSync("USER/ROBANALOG.SET", [analogStyle, analogDetail ? 1 : 0, locked ? 1 : 0].join(","));
    } catch (e) {
    }
  }

  function drawHeader(d) {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    frame(22, 6, w - 23, hgt - 8, 12);
    screen.drawLine(34, 34, w - 35, 34);
    screen.drawLine(34, 58, w - 35, 58);
    screen.setColor(3);
    setMono();
    drawFit("ROBCO INDUSTRIES (TM)", MARGIN, 8, 240, -1);
    drawFit(pad2(d.getHours()) + ":" + pad2(d.getMinutes()), w - MARGIN, 8, 90, 1);
    screen.setColor(1);
    setMono();
    drawFit("TERMLINK ANALOG MODULE", MARGIN, 36, 240, -1);
    drawFit("FACE " + styleNames[analogStyle], w - MARGIN, 36, 150, 1);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(34, hgt - 34, w - 35, hgt - 34);
    setVector(16);
    screen.setColor(1);
    drawFit("K1 FACE  K2 DATA", MARGIN, hgt - 27, 200, -1);
    screen.setColor(locked ? 3 : 1);
    drawFit(locked ? "LOCKED  K1 UNLOCK" : "K1 PRESS LOCK", w - MARGIN, hgt - 27, 224, 1);
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

  function spokes(cx, cy, r, inner, count) {
    var i;
    for (i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 - Math.PI / 2;
      line(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }

  function cardinalBars(cx, cy, r) {
    line(cx - 8, cy - r + 21, cx + 8, cy - r + 21);
    line(cx - 8, cy + r - 21, cx + 8, cy + r - 21);
    line(cx - r + 21, cy - 8, cx - r + 21, cy + 8);
    line(cx + r - 21, cy - 8, cx + r - 21, cy + 8);
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
      screen.setColor(1);
      line(cx - r + 20, cy, cx - r + 46, cy);
      line(cx + r - 46, cy, cx + r - 20, cy);
      line(cx, cy - r + 20, cx, cy - r + 46);
      line(cx, cy + r - 46, cx, cy + r - 20);
    } else if (analogStyle === 2) {
      screen.drawCircle(cx, cy, r - 4);
      tickRing(cx, cy, r, false);
      numerals(cx, cy, r, true);
      hourDots(cx, cy, r);
    } else if (analogStyle === 3) {
      screen.drawCircle(cx, cy, r - 10);
      screen.drawCircle(cx, cy, r - 34);
      tickRing(cx, cy, r, false);
      screen.setColor(1);
      spokes(cx, cy, r - 16, r - 34, 12);
      cardinalBars(cx, cy, r);
      setVector(18).setFontAlign(0, 0).drawString("VAULT", cx, cy - 48);
    } else if (analogStyle === 4) {
      screen.drawCircle(cx, cy, r - 18);
      screen.drawCircle(cx, cy, r - 42);
      tickRing(cx, cy, r, true);
      screen.setColor(1);
      spokes(cx, cy, r - 4, r - 42, 24);
      hourDots(cx, cy, r - 16);
    } else {
      screen.drawCircle(cx, cy, r - 6);
      screen.drawCircle(cx, cy, r - 28);
      tickRing(cx, cy, r, false);
      screen.setColor(1);
      spokes(cx, cy, r - 10, r - 30, 6);
      numerals(cx, cy, r, true);
      line(cx - 48, cy - 48, cx + 48, cy + 48);
      line(cx - 48, cy + 48, cx + 48, cy - 48);
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
    setMono();
    drawFit("ROBCO " + styleNames[analogStyle], 360, 76, 160, 0);
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
      drawVectorFit(pad2(d.getHours()) + ":" + pad2(m) + ":" + pad2(s), 360, 130, 160, 28, 20, 0);
      setMono();
      drawFit(days[d.getDay()], 360, 158, 160, 0);
      screen.setColor(1);
      setMono();
      drawFit(months[d.getMonth()] + " " + d.getDate(), 360, 188, 160, 0);
      drawFit("" + d.getFullYear(), 360, 214, 160, 0);
      drawFit("FACE " + styleNames[analogStyle], 360, 238, 160, 0);
    } else {
      screen.setColor(1);
      setMono();
      drawFit("DATE PANEL OFF", 360, 150, 160, 0);
      drawFit("FACE " + styleNames[analogStyle], 360, 188, 160, 0);
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

  // Knob 1 press toggles the lock (frozen face); while locked the knobs cannot
  // change the face or the data panel.
  function onKnob1(dir) {
    dir = dir | 0;
    if (dir === 0) {
      locked = !locked;
      dirty = true;
      sound("OK");
      safeDraw();
      return;
    }
    if (locked) return;
    analogStyle = wrap(analogStyle + dir, styleNames.length);
    dirty = true;
    sound("CLICK");
    safeDraw();
  }

  function onKnob2(dir) {
    dir = dir | 0;
    if (locked) return;
    if (dir === 0) analogDetail = !analogDetail;
    else analogStyle = wrap(analogStyle + dir, styleNames.length);
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
