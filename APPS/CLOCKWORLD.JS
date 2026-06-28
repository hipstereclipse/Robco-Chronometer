(function() {
  var appId = "ROBWORLD";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  // Inset for content near the rounded-corner bezel so nothing is clipped.
  var MARGIN = 32;
  var MS_PER_MIN = 60000;
  var MS_PER_DAY = 86400000;
  var worldIndex = 1;
  var locked = false;
  var dirty = false;
  var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var zones = [
    ["UTC", 0, 0, "UTC", "", 0, 0],
    ["NYC", -300, 1, "EST", "EDT", -74, 41],
    ["CHI", -360, 1, "CST", "CDT", -87, 42],
    ["DEN", -420, 1, "MST", "MDT", -105, 40],
    ["L.A.", -480, 1, "PST", "PDT", -118, 34],
    ["LONDON", 0, 2, "GMT", "BST", 0, 51],
    ["PARIS", 60, 2, "CET", "CEST", 2, 49],
    ["TOKYO", 540, 0, "JST", "", 140, 36],
    ["SYDNEY", 600, 3, "AEST", "AEDT", 151, -34],
    ["ADELAIDE", 570, 3, "ACST", "ACDT", 139, -35],
    ["AUCKLAND", 720, 4, "NZST", "NZDT", 175, -37]
  ];

  function nowMs() {
    return (new Date()).getTime();
  }

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
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

  function sound(id) {
    try {
      if (typeof Pip !== "undefined" && Pip.audioBuiltin) Pip.audioBuiltin(id);
    } catch (e) {
    }
  }

  function loadSettings() {
    try {
      var p = String(require("fs").readFileSync("USER/ROBWORLD.SET")).split(",");
      if (p.length >= 2) {
        worldIndex = Math.max(0, Math.min(zones.length - 1, p[0] | 0));
        locked = p[1] !== "0";
      }
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!dirty) return;
    try {
      require("fs").writeFileSync("USER/ROBWORLD.SET", [worldIndex, locked ? 1 : 0].join(","));
    } catch (e) {
    }
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year, month) {
    if (month === 1) return isLeapYear(year) ? 29 : 28;
    return month === 3 || month === 5 || month === 8 || month === 10 ? 30 : 31;
  }

  function leapDaysBeforeYear(year) {
    year--;
    return Math.floor(year / 4) - Math.floor(year / 100) + Math.floor(year / 400);
  }

  function daysBeforeYear(year) {
    return ((year - 1970) * 365) + leapDaysBeforeYear(year) - leapDaysBeforeYear(1970);
  }

  function daysBeforeMonth(year, month) {
    var m, days = 0;
    for (m = 0; m < month; m++) days += daysInMonth(year, m);
    return days;
  }

  function utcMs(year, month, day, hour) {
    return ((daysBeforeYear(year) + daysBeforeMonth(year, month) + day - 1) * MS_PER_DAY) + (hour * 3600000);
  }

  function dayOfWeek(year, month, day) {
    return wrap(daysBeforeYear(year) + daysBeforeMonth(year, month) + day - 1 + 4, 7);
  }

  function fieldsFromUtc(ms) {
    var dayCount = Math.floor(ms / MS_PER_DAY);
    var rem = ms - (dayCount * MS_PER_DAY);
    var year, dayOfYear, month, dim;
    if (rem < 0) {
      rem += MS_PER_DAY;
      dayCount--;
    }
    year = 1970 + Math.floor(dayCount / 365.2425);
    while (dayCount < daysBeforeYear(year)) year--;
    while (dayCount >= daysBeforeYear(year + 1)) year++;
    dayOfYear = dayCount - daysBeforeYear(year);
    month = 0;
    while (month < 11) {
      dim = daysInMonth(year, month);
      if (dayOfYear < dim) break;
      dayOfYear -= dim;
      month++;
    }
    return {
      year: year,
      month: month,
      date: dayOfYear + 1,
      day: wrap(dayCount + 4, 7),
      hour: Math.floor(rem / 3600000),
      minute: Math.floor((rem % 3600000) / MS_PER_MIN)
    };
  }

  function nthSunday(year, month, nth) {
    return 1 + ((7 - dayOfWeek(year, month, 1)) % 7) + ((nth - 1) * 7);
  }

  function lastSunday(year, month) {
    var d = daysInMonth(year, month);
    return d - dayOfWeek(year, month, d);
  }

  function transitionUtc(year, month, day, hour, offsetMinutes) {
    return utcMs(year, month, day, hour) - (offsetMinutes * MS_PER_MIN);
  }

  function isDstUs(utc, std) {
    var y = fieldsFromUtc(utc + (std * MS_PER_MIN)).year;
    return utc >= transitionUtc(y, 2, nthSunday(y, 2, 2), 2, std) &&
      utc < transitionUtc(y, 10, nthSunday(y, 10, 1), 2, std + 60);
  }

  function isDstEu(utc) {
    var y = fieldsFromUtc(utc).year;
    return utc >= utcMs(y, 2, lastSunday(y, 2), 1) &&
      utc < utcMs(y, 9, lastSunday(y, 9), 1);
  }

  function isDstAus(utc, std) {
    var y = fieldsFromUtc(utc + (std * MS_PER_MIN)).year;
    return utc >= transitionUtc(y, 9, nthSunday(y, 9, 1), 2, std) ||
      utc < transitionUtc(y, 3, nthSunday(y, 3, 1), 3, std + 60);
  }

  function isDstNz(utc, std) {
    var y = fieldsFromUtc(utc + (std * MS_PER_MIN)).year;
    return utc >= transitionUtc(y, 8, lastSunday(y, 8), 2, std) ||
      utc < transitionUtc(y, 3, nthSunday(y, 3, 1), 3, std + 60);
  }

  function zoneIsDst(i, utc) {
    var z = zones[i];
    if (z[2] === 1) return isDstUs(utc, z[1]);
    if (z[2] === 2) return isDstEu(utc);
    if (z[2] === 3) return isDstAus(utc, z[1]);
    if (z[2] === 4) return isDstNz(utc, z[1]);
    return false;
  }

  function zoneOffset(i, utc) {
    return zones[i][1] + (zoneIsDst(i, utc) ? 60 : 0);
  }

  function zoneAbbr(i, utc) {
    return zoneIsDst(i, utc) && zones[i][4] ? zones[i][4] : zones[i][3];
  }

  function zoneDate(i, utc) {
    return fieldsFromUtc(utc + (zoneOffset(i, utc) * MS_PER_MIN));
  }

  function formatTime(d, zone) {
    return pad2(zone ? d.hour : d.getHours()) + ":" + pad2(zone ? d.minute : d.getMinutes());
  }

  function formatDate(d) {
    return days[d.getDay()] + " " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatOffset(minutes) {
    if (minutes === 0) return "UTC";
    return "UTC" + (minutes > 0 ? "+" : "-") + pad2(Math.floor(Math.abs(minutes) / 60)) + ":" + pad2(Math.abs(minutes) % 60);
  }

  function localOffsetText() {
    var d = new Date();
    return d.getTimezoneOffset ? formatOffset(-d.getTimezoneOffset()) : "LOCAL";
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
    drawFit(formatTime(d, false), w - MARGIN, 8, 90, 1);
    screen.setColor(1);
    setMono();
    drawFit("TERMLINK WORLD RELAY", MARGIN, 36, 240, -1);
    drawFit("NODE " + zones[worldIndex][0], w - MARGIN, 36, 150, 1);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(34, hgt - 34, w - 35, hgt - 34);
    setVector(16);
    screen.setColor(1);
    drawFit("K1/K2 TURN ZONES", MARGIN, hgt - 27, 200, -1);
    screen.setColor(locked ? 3 : 1);
    drawFit(locked ? "LOCKED  K1 UNLOCK" : "K1 PRESS LOCK", w - MARGIN, hgt - 27, 224, 1);
  }

  function draw() {
    if (!screen) return;
    var w = screen.getWidth ? screen.getWidth() : 480;
    var utc = nowMs();
    var now = new Date();
    var i;
    drawHeader(now);
    screen.setColor(1);
    screen.drawRect(34, 72, 232, 270);
    screen.drawLine(34, 100, 232, 100);
    setMono();
    drawFit("LOCAL VAULT NODE", 133, 80, 184, 0);
    screen.setColor(3);
    setVector(38).setFontAlign(0, 0).drawString(formatTime(now, false), 133, 126);
    setMono();
    drawFit("RTC LINK ACTIVE", 133, 164, 184, 0);
    screen.setColor(1);
    setMono();
    drawFit(formatDate(now), 133, 190, 184, 0);
    drawFit(localOffsetText(), 133, 214, 184, 0);
    drawFit(zones[worldIndex][0] + " " + zoneAbbr(worldIndex, utc), 133, 238, 184, 0);
    drawFit(zoneIsDst(worldIndex, utc) ? "SUMMER TIME" : "STANDARD TIME", 133, 252, 184, 0);
    screen.drawRect(244, 72, w - 24, 270);
    screen.drawLine(244, 100, w - 24, 100);
    setMono();
    drawFit("WASTELAND RELAY", 254, 80, w - 278, -1);
    // Three roomy columns -- city (left), zone (left @348), time (right edge) --
    // with the decorative node address dropped so the zone and time never collide.
    for (i = 0; i < 5; i++) {
      var zi = (worldIndex + i) % zones.length;
      var zd = zoneDate(zi, utc);
      var y = 118 + (i * 30);
      screen.setColor(i === 0 ? 3 : 1);
      setVector(14).setFontAlign(-1, 0).drawString(fitText(zones[zi][0], 90), 254, y);
      setVector(14).setFontAlign(-1, 0).drawString(fitText(zoneAbbr(zi, utc), 44), 348, y);
      setVector(14).setFontAlign(1, 0).drawString(formatTime(zd, true), w - 32, y);
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

  function turnZone(dir) {
    worldIndex = wrap(worldIndex + dir, zones.length);
    dirty = true;
    sound("CLICK");
    safeDraw();
  }

  // Knob press toggles the zone lock (frozen view); turning is ignored while
  // locked so the relay can't be scrolled away by accident.
  function onKnob1(dir) {
    dir = dir | 0;
    if (dir === 0) {
      locked = !locked;
      dirty = true;
      sound("OK");
      safeDraw();
    } else if (!locked) {
      turnZone(dir);
    }
  }

  function onKnob2(dir) {
    dir = dir | 0;
    if (dir !== 0 && !locked) turnZone(dir);
  }

  loadSettings();

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", onKnob1);
    Pip.on("knob2", onKnob2);
  }
  ticker = setInterval(safeDraw, 10000);
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
