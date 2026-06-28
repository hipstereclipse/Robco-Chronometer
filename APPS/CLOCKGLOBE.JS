(function() {
  var appId = "ROBGLOBE";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var ticker;
  // Inset for content near the rounded-corner bezel so nothing is clipped.
  var MARGIN = 32;
  var MS_PER_MIN = 60000;
  var MS_PER_DAY = 86400000;
  var worldIndex = 14;
  var monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  // Civil UTC offsets in active use, including half-hour and quarter-hour bands.
  // The globe centers on each zone's standard meridian instead of a sample city.
  var zones = [-720, -660, -600, -570, -540, -480, -420, -360, -300, -240, -210, -180, -120, -60, 0, 60, 120, 180, 210, 240, 270, 300, 330, 345, 360, 390, 420, 480, 525, 540, 570, 600, 630, 660, 720, 765, 780, 825, 840];
  var px = 0, py = 0, sunX = 0, sunY = 0, sunZ = 0;

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
    var best = 14;
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

  function zoneDate(i, utc) {
    return fieldsFromUtc(utc + (zoneOffset(i, utc) * MS_PER_MIN));
  }

  function zoneLon(i) {
    return wrapLon(zoneOffset(i, 0) / 4);
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

  // Projection center, cached once per draw so project() avoids recomputing the
  // center's sin/cos (and any trig at all for it) for every one of the hundreds
  // of graticule/coastline points -- that redundant trig was the redraw stall.
  var ctrLon = 0, sinP0 = 0, cosP0 = 1;

  function setCenter(centerLat, centerLon) {
    var p0 = centerLat * Math.PI / 180;
    ctrLon = centerLon;
    sinP0 = Math.sin(p0);
    cosP0 = Math.cos(p0);
  }

  function project(cx, cy, r, lon, lat) {
    var dlon = wrapLon(lon - ctrLon) * Math.PI / 180;
    var phi = lat * Math.PI / 180;
    var sphi = Math.sin(phi), cphi = Math.cos(phi);
    var cdl = Math.cos(dlon), sdl = Math.sin(dlon);
    var cosc = (sinP0 * sphi) + (cosP0 * cphi * cdl);
    if (cosc < 0) return false;
    px = cx + (r * cphi * sdl);
    py = cy - (r * ((cosP0 * sphi) - (sinP0 * cphi * cdl)));
    return true;
  }

  function drawMeridian(cx, cy, r, lon) {
    var lat, have = false, lx = 0, ly = 0;
    for (lat = -90; lat <= 90; lat += 10) {
      if (project(cx, cy, r, lon, lat)) {
        if (have) line(lx, ly, px, py);
        lx = px; ly = py; have = true;
      } else {
        have = false;
      }
    }
  }

  function drawParallel(cx, cy, r, lat) {
    var lon, have = false, lx = 0, ly = 0;
    for (lon = ctrLon - 180; lon <= ctrLon + 180; lon += 10) {
      if (project(cx, cy, r, lon, lat)) {
        if (have) line(lx, ly, px, py);
        lx = px; ly = py; have = true;
      } else {
        have = false;
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

  function drawCoast(cx, cy, r) {
    var s, i, pts, have, lx = 0, ly = 0;
    for (s = 0; s < land.length; s++) {
      pts = land[s];
      have = false;
      for (i = 0; i < pts.length; i += 2) {
        if (project(cx, cy, r, pts[i], pts[i + 1])) {
          if (have) line(lx, ly, px, py);
          lx = px; ly = py; have = true;
        } else {
          have = false;
        }
      }
    }
  }

  function setSun(centerLat, centerLon, utc) {
    var d = fieldsFromUtc(utc);
    var n = daysBeforeMonth(d.year, d.month) + d.date;
    var dec = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI * (n + 10) / 365.24);
    var ut = d.hour + (d.minute / 60) + (d.second / 3600);
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
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.reset().clear();
    screen.setColor(1);
    screen.drawRect(22, 6, w - 23, hgt - 8);
    screen.drawLine(22, 34, w - 23, 34);
    screen.drawLine(22, 58, w - 23, 58);
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO INDUSTRIES (TM)", MARGIN, 8);
    setMono().setFontAlign(1, -1).drawString(formatTime(d), w - MARGIN, 8);
    screen.setColor(1);
    setMono().setFontAlign(-1, -1).drawString("TERMLINK ORBITAL MAP", MARGIN, 36);
    setMono().setFontAlign(1, -1).drawString("TZ " + (worldIndex + 1) + "/" + zones.length, w - MARGIN, 36);
  }

  function drawFooter() {
    var w = screen.getWidth ? screen.getWidth() : 480;
    var hgt = screen.getHeight ? screen.getHeight() : 320;
    screen.setColor(1);
    screen.drawLine(22, hgt - 34, w - 23, hgt - 34);
    setMono().setFontAlign(-1, -1).drawString("K1 TZ BAND +/-", MARGIN, hgt - 24);
    setMono().setFontAlign(1, -1).drawString("K2 TZ BAND +/-", w - MARGIN, hgt - 24);
  }

  function draw() {
    if (!screen) return;
    var utc = nowMs();
    var zi = safeZone(worldIndex);
    worldIndex = zi;
    var label = zoneAbbr(zi, utc);
    var lon = zoneLon(zi);
    var lat = 0;
    var zd = zoneDate(zi, utc);
    var cx = 150, cy = 166, r = 104;
    var i;
    setSun(lat, lon, utc);
    var elev = Math.asin(Math.max(-1, Math.min(1, sunZ))) * 180 / Math.PI;
    var phase = elev >= 0 ? "DAYLIGHT" : (elev >= -12 ? "TWILIGHT" : "NIGHT");
    setCenter(lat, lon);
    drawHeader(zd);
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
    setMono().setFontAlign(0, -1).drawString("ROBCO TZ RELAY", 348, 72);
    screen.setColor(1);
    screen.drawRect(272, 96, 430, 280);
    screen.drawLine(272, 122, 430, 122);
    setMono().setFontAlign(0, -1).drawString(label, 351, 102);
    screen.setColor(3);
    setVector(30).setFontAlign(0, 0).drawString(formatTime(zd), 351, 154);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(monthNames[zd.month] + " " + zd.date, 351, 188);
    setMono().setFontAlign(0, -1).drawString("MERIDIAN " + formatLon(lon), 351, 214);
    setMono().setFontAlign(0, -1).drawString("BAND " + (zi + 1) + "/" + zones.length, 351, 238);
    screen.setColor(elev >= 0 ? 3 : 1);
    setMono().setFontAlign(0, -1).drawString(phase + " " + (elev >= 0 ? "+" : "-") + Math.round(Math.abs(elev)), 351, 260);
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
    dir = dir | 0;
    if (dir !== 0) {
      worldIndex = wrap(safeZone(worldIndex) + dir, zones.length);
      sound("CLICK");
      safeDraw();
    } else {
      sound("OK");
    }
  }

  worldIndex = localZoneIndex();

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
