(function() {
  var appId = "ROBGLOBE";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  var homeIndex = 1;
  var worldIndex = 1;
  var monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
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
  var px = 0, py = 0, sunX = 0, sunY = 0, sunZ = 0;

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function wrap(n, max) {
    n = n % max;
    return n < 0 ? n + max : n;
  }

  function wrapLon(lon) {
    return ((lon + 180) % 360 + 360) % 360 - 180;
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

  function zoneIsDst(i, utc) {
    var z = zones[i];
    var m = (new Date(utc + (z[1] * 60000))).getUTCMonth();
    if (z[2] === 1) return m > 2 && m < 10;
    if (z[2] === 2) return m > 2 && m < 9;
    if (z[2] === 3) return m < 3 || m > 9;
    if (z[2] === 4) return m < 3 || m > 8;
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

  function utcNow() {
    var d = new Date();
    var t = d.getTime();
    if (d.getTimezoneOffset && d.getTimezoneOffset() !== 0) return t;
    return t - (zoneOffset(homeIndex, t) * 60000);
  }

  function formatTime(d) {
    return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes());
  }

  function formatFix(lat, lon) {
    var ns = lat === 0 ? "" : (lat < 0 ? "S" : "N");
    var ew = lon === 0 ? "" : (lon < 0 ? "W" : "E");
    return Math.abs(lat) + ns + " " + Math.abs(lon) + ew;
  }

  function project(cx, cy, r, centerLat, centerLon, lon, lat) {
    var dlon = wrapLon(lon - centerLon) * Math.PI / 180;
    var phi = lat * Math.PI / 180;
    var p0 = centerLat * Math.PI / 180;
    var cosc = Math.sin(p0) * Math.sin(phi) + Math.cos(p0) * Math.cos(phi) * Math.cos(dlon);
    if (cosc < 0) return false;
    px = cx + (r * Math.cos(phi) * Math.sin(dlon));
    py = cy - (r * ((Math.cos(p0) * Math.sin(phi)) - (Math.sin(p0) * Math.cos(phi) * Math.cos(dlon))));
    return true;
  }

  function drawMeridian(cx, cy, r, centerLat, centerLon, lon) {
    var lat, have = false, lx = 0, ly = 0;
    for (lat = -90; lat <= 90; lat += 10) {
      if (project(cx, cy, r, centerLat, centerLon, lon, lat)) {
        if (have) line(lx, ly, px, py);
        lx = px; ly = py; have = true;
      } else {
        have = false;
      }
    }
  }

  function drawParallel(cx, cy, r, centerLat, centerLon, lat) {
    var lon, have = false, lx = 0, ly = 0;
    for (lon = centerLon - 180; lon <= centerLon + 180; lon += 10) {
      if (project(cx, cy, r, centerLat, centerLon, lon, lat)) {
        if (have) line(lx, ly, px, py);
        lx = px; ly = py; have = true;
      } else {
        have = false;
      }
    }
  }

  function setSun(centerLat, centerLon, utc) {
    var d = new Date(utc);
    var n = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
    var dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI * (n + 10) / 365.24);
    var ut = d.getUTCHours() + (d.getUTCMinutes() / 60) + (d.getUTCSeconds() / 3600);
    var dl = wrapLon(((12 - ut) * 15) - centerLon) * Math.PI / 180;
    var p0 = centerLat * Math.PI / 180;
    sunX = Math.cos(dec) * Math.sin(dl);
    sunY = (Math.cos(p0) * Math.sin(dec)) - (Math.sin(p0) * Math.cos(dec) * Math.cos(dl));
    sunZ = (Math.sin(p0) * Math.sin(dec)) + (Math.cos(p0) * Math.cos(dec) * Math.cos(dl));
  }

  function drawTerminator(cx, cy, r) {
    var ax = -sunZ;
    var ay = 0;
    var az = sunX;
    var m = Math.sqrt((ax * ax) + (az * az));
    var th, have = false, lx = 0, ly = 0;
    if (m < 1e-6) { ax = 1; az = 0; m = 1; }
    ax /= m; az /= m;
    var bx = sunY * az;
    var by = (sunZ * ax) - (sunX * az);
    var bz = -sunY * ax;
    screen.setColor(3);
    for (th = 0; th <= 360; th += 8) {
      var c = Math.cos(th * Math.PI / 180);
      var s = Math.sin(th * Math.PI / 180);
      var pz = (az * c) + (bz * s);
      if (pz < 0) {
        have = false;
      } else {
        var x = cx + (((ax * c) + (bx * s)) * r);
        var y = cy - (((ay * c) + (by * s)) * r);
        if (have) line(lx, ly, x, y);
        lx = x; ly = y; have = true;
      }
    }
  }

  function drawHeader(d) {
    var w = screen.getWidth ? screen.getWidth() : 480;
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO GLOBE", 22, 10);
    setMono().setFontAlign(1, -1).drawString(formatTime(d), w - 22, 10);
    screen.drawLine(18, 38, w - 18, 38);
    setMono().setFontAlign(0, -1).drawString("GLOBE", w / 2, 42);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    var y = hgt - 32;
    screen.setColor(1);
    screen.drawLine(18, y - 8, w - 18, y - 8);
    setMono().setFontAlign(-1, -1).drawString("K1 ZONES", 22, y);
    setMono().setFontAlign(1, -1).drawString("K2 ZONES", w - 22, y);
  }

  function draw() {
    if (!screen) return;
    var utc = utcNow();
    var z = zones[worldIndex];
    var zd = zoneDate(worldIndex, utc);
    var cx = 150, cy = 166, r = 104;
    var i;
    setSun(z[6], z[5], utc);
    var elev = Math.asin(Math.max(-1, Math.min(1, sunZ))) * 180 / Math.PI;
    var phase = elev >= 0 ? "DAYLIGHT" : (elev >= -12 ? "TWILIGHT" : "NIGHT");
    drawHeader(zd);
    screen.setColor(3);
    screen.drawCircle(cx, cy, r);
    screen.drawCircle(cx, cy, r - 2);
    screen.setColor(1);
    for (i = -60; i <= 60; i += 30) drawParallel(cx, cy, r, z[6], z[5], i);
    for (i = -180; i < 180; i += 30) drawMeridian(cx, cy, r, z[6], z[5], i);
    drawMeridian(cx, cy, r, z[6], z[5], wrapLon((zoneOffset(worldIndex, utc) / 60) * 15));
    drawTerminator(cx, cy, r);
    screen.setColor(3);
    screen.drawCircle(cx, cy, 5);
    line(cx - 9, cy, cx - 3, cy);
    line(cx + 3, cy, cx + 9, cy);
    line(cx, cy - 9, cx, cy - 3);
    line(cx, cy + 3, cx, cy + 9);
    if (sunZ > 0) screen.drawCircle(cx + (sunX * r), cy - (sunY * r), 3);
    setMono().setFontAlign(0, -1).drawString("ROBCO ORBITAL RELAY", 348, 72);
    screen.setColor(1);
    screen.drawRect(272, 96, 430, 274);
    setMono().setFontAlign(0, -1).drawString(z[0] + " " + zoneAbbr(worldIndex, utc), 351, 112);
    setVector(30).setFontAlign(0, 0).drawString(formatTime(zd), 351, 154);
    setMono().setFontAlign(0, -1).drawString(monthNames[zd.getUTCMonth()] + " " + zd.getUTCDate(), 351, 188);
    setMono().setFontAlign(0, -1).drawString("FIX " + formatFix(z[6], z[5]), 351, 220);
    screen.setColor(elev >= 0 ? 3 : 1);
    setMono().setFontAlign(0, -1).drawString(phase + " " + (elev >= 0 ? "+" : "-") + Math.round(Math.abs(elev)), 351, 248);
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
  ticker = setInterval(safeDraw, 60000);
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
