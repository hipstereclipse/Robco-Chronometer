(function() {
  var appId = "ROBWORLD";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  // Inset for content near the rounded-corner bezel so nothing is clipped.
  var MARGIN = 32;
  var worldIndex = 1;
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

  function nthSunday(year, month, nth) {
    var d = new Date(Date.UTC(year, month, 1));
    return 1 + ((7 - d.getUTCDay()) % 7) + ((nth - 1) * 7);
  }

  function lastSunday(year, month) {
    var d = new Date(Date.UTC(year, month + 1, 0));
    return d.getUTCDate() - d.getUTCDay();
  }

  function transitionUtc(year, month, day, hour, offsetMinutes) {
    return Date.UTC(year, month, day, hour, 0, 0) - (offsetMinutes * 60000);
  }

  function isDstUs(utc, std) {
    var y = (new Date(utc + (std * 60000))).getUTCFullYear();
    return utc >= transitionUtc(y, 2, nthSunday(y, 2, 2), 2, std) &&
      utc < transitionUtc(y, 10, nthSunday(y, 10, 1), 2, std + 60);
  }

  function isDstEu(utc) {
    var y = (new Date(utc)).getUTCFullYear();
    return utc >= Date.UTC(y, 2, lastSunday(y, 2), 1, 0, 0) &&
      utc < Date.UTC(y, 9, lastSunday(y, 9), 1, 0, 0);
  }

  function isDstAus(utc, std) {
    var y = (new Date(utc + (std * 60000))).getUTCFullYear();
    return utc >= transitionUtc(y, 9, nthSunday(y, 9, 1), 2, std) ||
      utc < transitionUtc(y, 3, nthSunday(y, 3, 1), 3, std + 60);
  }

  function isDstNz(utc, std) {
    var y = (new Date(utc + (std * 60000))).getUTCFullYear();
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
    return new Date(utc + (zoneOffset(i, utc) * 60000));
  }

  function formatTime(d, utc) {
    return pad2(utc ? d.getUTCHours() : d.getHours()) + ":" + pad2(utc ? d.getUTCMinutes() : d.getMinutes());
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
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO WORLD CLOCK", MARGIN, 8);
    setMono().setFontAlign(1, -1).drawString(formatTime(d, false), w - MARGIN, 8);
    screen.drawLine(0, 32, w, 32);
    setMono().setFontAlign(0, -1).drawString("WORLD", w / 2, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(0, hgt - 32, w, hgt - 32);
    setMono().setFontAlign(-1, -1).drawString("K1 ZONES", MARGIN, hgt - 24);
    setMono().setFontAlign(1, -1).drawString("K2 ZONES", w - MARGIN, hgt - 24);
  }

  function draw() {
    if (!screen) return;
    var w = screen.getWidth ? screen.getWidth() : 480;
    var utc = nowMs();
    var now = new Date();
    var i;
    drawHeader(now);
    screen.setColor(3);
    setVector(40).setFontAlign(0, 0).drawString(formatTime(now, false), 118, 120);
    setMono().setFontAlign(0, -1).drawString("LOCAL VAULT CLOCK", 118, 164);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(formatDate(now), 118, 190);
    setMono().setFontAlign(0, -1).drawString(localOffsetText(), 118, 216);
    setMono().setFontAlign(0, -1).drawString(zones[worldIndex][0] + " " + zoneAbbr(worldIndex, utc), 118, 242);
    setMono().setFontAlign(0, -1).drawString(formatOffset(zoneOffset(worldIndex, utc)) + " " + (zoneIsDst(worldIndex, utc) ? "SUMMER" : "STANDARD"), 118, 266);
    screen.drawLine(242, 66, 242, 282);
    setMono().setFontAlign(-1, -1).drawString("WASTELAND RELAY", 260, 66);
    for (i = 0; i < 5; i++) {
      var zi = (worldIndex + i) % zones.length;
      var zd = zoneDate(zi, utc);
      var y = 98 + (i * 36);
      screen.setColor(i === 0 ? 3 : 1);
      setMono().setFontAlign(-1, 0).drawString(zones[zi][0], 260, y);
      setMono().setFontAlign(0, 0).drawString(zoneAbbr(zi, utc), 344, y);
      setMono().setFontAlign(1, 0).drawString(formatTime(zd, true), w - 14, y);
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

  function rotate(dir) {
    if (dir !== 0) {
      worldIndex = wrap(worldIndex + dir, zones.length);
      sound("CLICK");
      safeDraw();
    } else {
      sound("OK");
    }
  }

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", rotate);
    Pip.on("knob2", rotate);
  }
  ticker = setInterval(safeDraw, 10000);
  safeDraw();

  return {
    id: appId,
    notDefault: true,
    fullscreen: true,
    remove: function() {
      if (ticker) clearInterval(ticker);
      if (typeof Pip !== "undefined") {
        Pip.removeListener("knob1", rotate);
        Pip.removeListener("knob2", rotate);
      }
    }
  };
})
