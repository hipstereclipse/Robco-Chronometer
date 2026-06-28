(function() {
  var appId = "ROBGLOBE";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  // Inset for content near the rounded-corner bezel so nothing is clipped.
  var MARGIN = 32;
  var MS_PER_MIN = 60000;
  var MS_PER_DAY = 86400000;
  var worldIndex = 12;
  var homeIndex = 12;
  var locked = false;
  var dirty = false;
  var monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  // Whole-hour UTC bands only. The globe centers on each band meridian.
  var zones = [-720, -660, -600, -540, -480, -420, -360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840];
  var zoneNames = ["BAKER", "PAGO PAGO", "HONOLULU", "ANCHORAGE", "LOS ANGELES", "DENVER", "CHICAGO", "NEW YORK", "SANTIAGO", "BUENOS AIRES", "S. GEORGIA", "AZORES", "LONDON", "PARIS", "CAIRO", "MOSCOW", "DUBAI", "KARACHI", "DHAKA", "BANGKOK", "BEIJING", "TOKYO", "SYDNEY", "NOUMEA", "AUCKLAND", "APIA", "KIRITIMATI"];
  var px = 0, py = 0, sunX = 0, sunY = 0, sunZ = 0;
  var DEG = Math.PI / 180;
  var termC = [];
  var termS = [];
  // Trig-cached coastline, packed into one flat buffer (see prepLand). landData
  // holds [lon, cosLat, sinLat] per point with polylines concatenated; landLens
  // records each polyline's point count.
  var landData = null;
  var landLens = null;

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

  function wrapLon(lon) {
    return ((lon + 180) % 360 + 360) % 360 - 180;
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

  function drawScanlines(w, hgt) {
    var y;
    screen.setColor(1);
    for (y = 76; y < hgt - 44; y += 8) screen.drawLine(36, y, w - 37, y);
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
      var p = String(require("fs").readFileSync("USER/ROBGLOBE.SET")).split(",");
      if (p.length >= 2) {
        worldIndex = safeZone(p[0] | 0);
        locked = p[1] !== "0";
      }
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!dirty) return;
    try {
      require("fs").writeFileSync("USER/ROBGLOBE.SET", [worldIndex, locked ? 1 : 0].join(","));
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
      minute: Math.floor((rem % 3600000) / MS_PER_MIN),
      second: Math.floor((rem % MS_PER_MIN) / 1000)
    };
  }

  function localZoneIndex() {
    var d = new Date();
    var local = d.getTimezoneOffset ? -d.getTimezoneOffset() : 0;
    var best = 12;
    var diff = 9999;
    var i;
    for (i = 0; i < zones.length; i++) {
      var nd = Math.abs(zones[i] - local);
      if (nd < diff) {
        best = i;
        diff = nd;
      }
    }
    return best;
  }

  function safeZone(i) {
    if (i !== i) return localZoneIndex();
    i = i | 0;
    if (i < 0 || i >= zones.length) return localZoneIndex();
    return i;
  }

  function formatOffset(minutes) {
    if (minutes === 0) return "UTC";
    return "UTC" + (minutes > 0 ? "+" : "-") + pad2(Math.floor(Math.abs(minutes) / 60)) + ":" + pad2(Math.abs(minutes) % 60);
  }

  function zoneOffset(i, utc) {
    return zones[safeZone(i)];
  }

  function zoneAbbr(i, utc) {
    return formatOffset(zoneOffset(i, utc));
  }

  function zoneName(i) {
    return zoneNames[safeZone(i)];
  }

  function zoneDate(i, utc) {
    return fieldsFromUtc(utc + (zoneOffset(i, utc) * MS_PER_MIN));
  }

  function zoneLon(i) {
    return wrapLon(zoneOffset(i, 0) / 4);
  }

  // Compact whole-hour offset for the tight header rail, e.g. "UTC-4" / "UTC+9".
  function shortOffset(minutes) {
    if (minutes === 0) return "UTC";
    return "UTC" + (minutes > 0 ? "+" : "-") + Math.floor(Math.abs(minutes) / 60);
  }

  function formatTime(d) {
    return pad2(d.hour) + ":" + pad2(d.minute);
  }

  function formatCoord(v, pos, neg) {
    var h = v === 0 ? "" : (v < 0 ? neg : pos);
    var a = Math.round(Math.abs(v) * 100) / 100;
    if (a === Math.floor(a)) a = Math.floor(a);
    return a + h;
  }

  function formatLon(lon) {
    return formatCoord(lon, "E", "W");
  }

  function formatFix(lat, lon) {
    return formatCoord(lat, "N", "S") + " " + formatCoord(lon, "E", "W");
  }

  // The globe is always equator-centered; projection can therefore skip the
  // general oblique math and cull by longitude before drawing.
  var ctrLon = 0;

  function setCenter(centerLat, centerLon) {
    ctrLon = centerLon;
  }

  function project(cx, cy, r, lon, lat) {
    var d = wrapLon(lon - ctrLon);
    var phi;
    if (d < -90 || d > 90) return false;
    phi = lat * DEG;
    px = cx + (r * Math.cos(phi) * Math.sin(d * DEG));
    py = cy - (r * Math.sin(phi));
    return true;
  }

  function projectUnit(cx, cy, r, lon, cosLat, sinLat) {
    var d = wrapLon(lon - ctrLon);
    if (d < -90 || d > 90) return false;
    px = cx + (r * cosLat * Math.sin(d * DEG));
    py = cy - (r * sinLat);
    return true;
  }

  function drawMeridian(cx, cy, r, lon) {
    var lat, lx = 0, ly = 0, d = wrapLon(lon - ctrLon), sd;
    if (d < -90 || d > 90) return;
    sd = Math.sin(d * DEG);
    for (lat = -90; lat <= 90; lat += 15) {
      var phi = lat * DEG;
      px = cx + (r * Math.cos(phi) * sd);
      py = cy - (r * Math.sin(phi));
      if (lat > -90) line(lx, ly, px, py);
      lx = px; ly = py;
    }
  }

  function drawParallel(cx, cy, r, lat) {
    var lon, have = false, lx = 0, ly = 0;
    var phi = lat * DEG;
    var cl = Math.cos(phi), sl = Math.sin(phi);
    for (lon = ctrLon - 90; lon <= ctrLon + 90; lon += 15) {
      if (projectUnit(cx, cy, r, lon, cl, sl)) {
        if (have) line(lx, ly, px, py);
        lx = px; ly = py; have = true;
      }
    }
  }

  // Low-poly coastline traces (lon,lat pairs) tuned for the 104 px globe; these
  // mirror $LandShapes in tools/render-clock-suite-previews.ps1 -- keep in sync.
  var land = [
    [-168,72,-158,71,-151,67,-143,69,-136,59,-130,55,-127,50,-124,49,-124,43,-121,38,-117,33,-112,29,-106,23,-98,19,-91,18,-88,21,-84,22,-81,25,-80,29,-81,31,-79,33,-76,36,-75,39,-71,42,-67,45,-61,46,-57,50,-60,54,-67,56,-76,57,-82,62,-91,63,-96,68,-109,69,-121,71,-134,70,-145,72,-158,74,-168,72],
    [-95,59,-88,58,-82,55,-78,51,-83,49,-90,52,-95,59],
    [-53,83,-37,83,-23,79,-17,72,-23,66,-36,60,-49,59,-58,64,-63,71,-60,78,-53,83],
    [-81,12,-75,11,-69,9,-63,3,-59,-4,-54,-9,-50,-18,-44,-23,-41,-33,-46,-39,-50,-50,-58,-55,-65,-54,-70,-49,-73,-42,-76,-32,-78,-20,-81,-7,-81,4,-81,12],
    [-10,36,-9,43,-5,50,0,51,4,58,12,56,18,60,25,66,32,70,40,68,33,60,39,55,31,50,23,46,17,43,12,45,5,43,0,38,-6,36,-10,36],
    [28,41,36,38,44,36,51,31,60,29,67,25,76,31,85,28,94,23,100,13,106,22,116,22,122,30,132,31,139,35,145,42,155,44,166,51,159,59,143,62,128,70,105,72,82,72,63,67,52,62,43,56,33,57,28,50,28,41],
    [-17,35,-6,36,5,36,16,33,25,31,32,25,35,19,43,12,51,4,49,-5,43,-12,40,-22,33,-31,25,-34,18,-35,11,-31,5,-22,-3,-11,-10,2,-16,14,-17,25,-17,35],
    [34,29,43,29,51,25,58,17,55,13,47,12,42,16,38,24,34,29],
    [68,24,73,19,78,8,82,7,88,21,80,27,73,26,68,24],
    [93,22,101,20,108,16,109,10,105,6,99,9,96,15,93,22],
    [95,6,105,4,117,1,126,-3,132,-5,124,-8,112,-5,104,-6,97,0,95,6],
    [132,-2,142,-4,153,-5,150,-10,139,-9,132,-2],
    [112,-11,116,-21,114,-29,121,-35,134,-39,146,-43,153,-37,153,-28,147,-20,138,-15,128,-13,119,-14,112,-11],
    [48,-12,51,-20,49,-26,44,-25,43,-18,48,-12],
    [-8,58,-3,56,-2,51,-5,50,-8,52,-8,58],
    [-25,66,-14,65,-14,63,-24,63,-25,66],
    [130,34,135,32,141,36,145,43,140,45,133,40,130,34],
    [166,-35,178,-38,177,-45,169,-47,166,-42,166,-35],
    [145,-40,149,-43,146,-45,143,-43,145,-40],
    [-180,-68,-160,-71,-135,-70,-110,-73,-80,-71,-55,-74,-25,-71,0,-70,32,-73,62,-70,95,-72,130,-69,160,-72,180,-68]
  ];

  // Pack the nested land[] literal into a single Float32Array of trig-cached
  // points, then release the literal. Keeping only the flat buffer (one
  // ArrayBuffer) instead of a second nested array avoids the ~1200 extra JsVars
  // that exhausted memory on-device. Each polyline is freed as it is packed to
  // keep the transient peak low.
  function prepLand() {
    var s, i, pts, lat, total = 0, w = 0;
    if (landData) return;
    for (s = 0; s < land.length; s++) total += land[s].length >> 1;
    landData = new Float32Array(total * 3);
    landLens = [];
    for (s = 0; s < land.length; s++) {
      pts = land[s];
      landLens.push(pts.length >> 1);
      for (i = 0; i < pts.length; i += 2) {
        lat = pts[i + 1] * DEG;
        landData[w++] = pts[i];
        landData[w++] = Math.cos(lat);
        landData[w++] = Math.sin(lat);
      }
      land[s] = null;
    }
    land = null;
  }

  function drawCoast(cx, cy, r) {
    var s, i, n, k = 0, have, lx = 0, ly = 0;
    prepLand();
    for (s = 0; s < landLens.length; s++) {
      n = landLens[s];
      have = false;
      for (i = 0; i < n; i++) {
        if (projectUnit(cx, cy, r, landData[k], landData[k + 1], landData[k + 2])) {
          if (have) line(lx, ly, px, py);
          lx = px; ly = py; have = true;
        } else {
          have = false;
        }
        k += 3;
      }
    }
  }

  function setSun(centerLat, centerLon, utc) {
    var d = fieldsFromUtc(utc);
    var n = daysBeforeMonth(d.year, d.month) + d.date;
    var dec = -23.44 * DEG * Math.cos(2 * Math.PI * (n + 10) / 365.24);
    var ut = d.hour + (d.minute / 60) + (d.second / 3600);
    var dl = wrapLon(((12 - ut) * 15) - centerLon) * DEG;
    sunX = Math.cos(dec) * Math.sin(dl);
    sunY = Math.sin(dec);
    sunZ = Math.cos(dec) * Math.cos(dl);
  }

  function prepTerminator() {
    var th;
    if (termC.length) return;
    for (th = 0; th <= 360; th += 10) {
      termC.push(Math.cos(th * DEG));
      termS.push(Math.sin(th * DEG));
    }
  }

  function drawTerminator(cx, cy, r) {
    var ax = -sunZ;
    var ay = 0;
    var az = sunX;
    var m = Math.sqrt((ax * ax) + (az * az));
    var i, have = false, lx = 0, ly = 0;
    if (m < 1e-6) { ax = 1; az = 0; m = 1; }
    ax /= m; az /= m;
    var bx = sunY * az;
    var by = (sunZ * ax) - (sunX * az);
    var bz = -sunY * ax;
    prepTerminator();
    screen.setColor(3);
    for (i = 0; i < termC.length; i++) {
      var c = termC[i];
      var s = termS[i];
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

  // d is the user's HOME-zone date: the top-right corner always reports the
  // device's own timezone, while the band selected by the knob is shown in the
  // middle relay panel.
  function drawHeader(d) {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    screen.drawLine(MARGIN, 42, w - MARGIN, 42);
    screen.drawLine(MARGIN, 66, w - MARGIN, 66);
    screen.setColor(3);
    setVector(15);
    drawFit("ROBCO TERMLINK", MARGIN, 12, 210, -1);
    drawFit(formatTime(d), w - MARGIN, 12, 90, 1);
    drawFit("> ORBITAL DAY/NIGHT MAP", MARGIN, 47, 282, -1);
    screen.setColor(1);
    drawFit("HOME " + shortOffset(zoneOffset(homeIndex)), w - MARGIN, 47, 140, 1);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(MARGIN, hgt - 40, w - MARGIN, hgt - 40);
    setVector(14);
    screen.setColor(1);
    drawFit("K1/K2 BANDS", MARGIN, hgt - 31, 200, -1);
    screen.setColor(locked ? 3 : 1);
    drawFit(locked ? "LOCKED  K1 UNLOCK" : "K1 LOCK", w - MARGIN, hgt - 31, 224, 1);
  }

  function draw() {
    if (!screen) return;
    var utc = nowMs();
    var zi = safeZone(worldIndex);
    worldIndex = zi;
    var label = zoneAbbr(zi, utc);
    var place = zoneName(zi);
    var lon = zoneLon(zi);
    var lat = 0;
    var zd = zoneDate(zi, utc);
    var cx = 150, cy = 170, r = 96;
    var i;
    setSun(lat, lon, utc);
    var elev = Math.asin(Math.max(-1, Math.min(1, sunZ))) * 180 / Math.PI;
    var phase = elev >= 0 ? "DAYLIGHT" : (elev >= -12 ? "TWILIGHT" : "NIGHT");
    setCenter(lat, lon);
    drawHeader(zoneDate(homeIndex, utc));
    screen.setColor(3);
    screen.drawCircle(cx, cy, r);
    screen.drawCircle(cx, cy, r - 2);
    screen.setColor(1);
    for (i = -60; i <= 60; i += 30) drawParallel(cx, cy, r, i);
    for (i = -180; i < 180; i += 30) drawMeridian(cx, cy, r, i);
    drawMeridian(cx, cy, r, wrapLon(lon - 7.5));
    drawMeridian(cx, cy, r, wrapLon(lon + 7.5));
    screen.setColor(3);
    drawMeridian(cx, cy, r, lon);
    drawCoast(cx, cy, r);
    drawTerminator(cx, cy, r);
    screen.setColor(3);
    screen.drawCircle(cx, cy, 5);
    line(cx - 9, cy, cx - 3, cy);
    line(cx + 3, cy, cx + 9, cy);
    line(cx, cy - 9, cx, cy - 3);
    line(cx, cy + 3, cx, cy + 9);
    if (sunZ > 0) screen.drawCircle(cx + (sunX * r), cy - (sunY * r), 3);
    setMono();
    drawFit("TZ RELAY // 0xA0", 350, 76, 170, 0);
    screen.setColor(1);
    screen.drawRect(272, 90, 430, 270);
    screen.drawLine(272, 134, 430, 134);
    setMono();
    drawFit(label, 351, 96, 146, 0);
    drawFit(place, 351, 116, 146, 0);
    screen.setColor(3);
    drawVectorFit(formatTime(zd), 351, 156, 146, 30, 22, 0);
    screen.setColor(1);
    setMono();
    drawFit(monthNames[zd.month] + " " + zd.date, 351, 186, 146, 0);
    drawFit("MERIDIAN " + formatLon(lon), 351, 210, 146, 0);
    drawFit("BAND " + (zi + 1) + "/" + zones.length, 351, 234, 146, 0);
    screen.setColor(elev >= 0 ? 3 : 1);
    setMono();
    drawFit(phase + " " + (elev >= 0 ? "+" : "-") + Math.round(Math.abs(elev)), 351, 252, 146, 0);
    drawFooter();
    if (screen.flip) screen.flip();
  }

  function safeDraw() {
    try {
      draw();
    } catch (e) {
    }
  }

  function turnBand(dir) {
    worldIndex = wrap(safeZone(worldIndex) + dir, zones.length);
    dirty = true;
    sound("CLICK");
    safeDraw();
  }

  // Knob press toggles the band lock (frozen view); turning is ignored while
  // locked so the displayed band can't be nudged by accident.
  function onKnob1(dir) {
    dir = dir | 0;
    if (dir === 0) {
      locked = !locked;
      dirty = true;
      sound("OK");
      safeDraw();
    } else if (!locked) {
      turnBand(dir);
    }
  }

  function onKnob2(dir) {
    dir = dir | 0;
    if (dir !== 0 && !locked) turnBand(dir);
  }

  homeIndex = localZoneIndex();
  worldIndex = homeIndex;
  loadSettings();

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", onKnob1);
    Pip.on("knob2", onKnob2);
  }
  ticker = setInterval(safeDraw, 60000);
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
