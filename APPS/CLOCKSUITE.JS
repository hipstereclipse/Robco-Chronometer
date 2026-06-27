(function() {
  var appId = "CLOCKSUITE";
  var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
  var modes = ["CLOCK", "WORLD", "GLOBE", "ANALOG", "STOPWATCH", "COUNTDOWN", "POMODORO"];
  var mode = 0;
  var ticker;
  var settingsDirty = false;

  var clockLayout = 1; // 0 time, 1 time+date, 2 field status, 3 vault status
  var showSeconds = true;
  var hour24 = true;
  var analogDetail = true;
  var analogStyle = 0;

  var worldIndex = 0;
  var worldZones = [
    { name: "UTC", std: 0, rule: "none", abbr: "UTC", lon: 0, lat: 0 },
    { name: "NYC", std: -300, rule: "us", abbr: "EST", dst: "EDT", lon: -74, lat: 41 },
    { name: "CHI", std: -360, rule: "us", abbr: "CST", dst: "CDT", lon: -87, lat: 42 },
    { name: "DEN", std: -420, rule: "us", abbr: "MST", dst: "MDT", lon: -105, lat: 40 },
    { name: "L.A.", std: -480, rule: "us", abbr: "PST", dst: "PDT", lon: -118, lat: 34 },
    { name: "LONDON", std: 0, rule: "eu", abbr: "GMT", dst: "BST", lon: 0, lat: 51 },
    { name: "PARIS", std: 60, rule: "eu", abbr: "CET", dst: "CEST", lon: 2, lat: 49 },
    { name: "TOKYO", std: 540, rule: "none", abbr: "JST", lon: 140, lat: 36 },
    { name: "SYDNEY", std: 600, rule: "aus", abbr: "AEST", dst: "AEDT", lon: 151, lat: -34 },
    { name: "ADELAIDE", std: 570, rule: "aus", abbr: "ACST", dst: "ACDT", lon: 139, lat: -35 },
    { name: "AUCKLAND", std: 720, rule: "nz", abbr: "NZST", dst: "NZDT", lon: 175, lat: -37 }
  ];

  var landShapes = [
    [-168,72,-150,71,-140,63,-131,58,-125,50,-124,42,-117,32,-106,24,-96,19,-88,21,-82,25,-80,31,-76,36,-70,43,-62,46,-53,51,-56,56,-68,58,-82,62,-94,67,-105,70,-121,72,-140,70,-156,72,-168,72],
    [-52,83,-30,81,-18,74,-25,66,-42,60,-56,63,-64,70,-60,78,-52,83],
    [-81,12,-72,10,-64,5,-58,-5,-51,-15,-46,-23,-48,-34,-54,-45,-65,-55,-72,-50,-75,-38,-79,-22,-81,0,-81,12],
    [-10,36,-6,44,5,52,20,58,38,56,52,64,72,70,98,72,124,64,146,55,161,45,151,36,132,32,122,23,107,22,100,8,88,6,78,20,68,23,60,30,52,28,45,36,36,42,26,40,18,46,8,43,0,38,-10,36],
    [-17,35,-5,37,10,35,24,32,34,27,43,13,51,5,46,-8,40,-20,32,-31,21,-35,10,-31,3,-20,-7,-5,-15,10,-17,25,-17,35],
    [34,29,45,27,56,24,58,15,48,12,42,18,34,29],
    [68,24,76,8,88,22,79,30,68,24],
    [95,7,108,7,121,14,119,1,104,-6,95,7],
    [112,-11,124,-14,136,-12,152,-24,153,-35,142,-43,128,-39,116,-33,112,-22,112,-11],
    [48,-12,51,-25,45,-26,43,-15,48,-12],
    [-8,58,-2,55,-4,50,-8,52,-8,58],
    [139,45,145,38,141,32,130,33,134,40,139,45],
    [173,-35,178,-42,166,-47,170,-40,173,-35],
    [-180,-68,-130,-72,-80,-70,-40,-74,0,-70,50,-73,110,-69,160,-72,180,-68]
  ];

  var stopwatchRunning = false;
  var stopwatchStart = 0;
  var stopwatchElapsed = 0;
  var stopwatchLap = -1;

  var countdownSet = 5 * 60;
  var countdownRemaining = countdownSet;
  var countdownRunning = false;
  var countdownEnd = 0;

  var pomoWork = 25 * 60;
  var pomoBreak = 5 * 60;
  var pomoPhase = 0;
  var pomoRemaining = pomoWork;
  var pomoRunning = false;
  var pomoEnd = 0;
  var pomoCycles = 0;

  var dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  var fullDayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  var monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  var layoutNames = ["TIME", "DATE", "FIELD", "VAULT"];

  function nowMs() {
    return (new Date()).getTime();
  }

  function pad2(n) {
    n = Math.floor(Math.abs(n));
    return n < 10 ? "0" + n : "" + n;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function wrap(n, max) {
    n = n % max;
    return n < 0 ? n + max : n;
  }

  function width() {
    return screen && screen.getWidth ? screen.getWidth() : 480;
  }

  function height() {
    return screen && screen.getHeight ? screen.getHeight() : 320;
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
      var txt = require("fs").readFileSync("USER/CLOCKSUITE.SET");
      var s = JSON.parse(txt);
      if (s.clockLayout !== undefined) clockLayout = clamp(s.clockLayout | 0, 0, layoutNames.length - 1);
      if (s.showSeconds !== undefined) showSeconds = !!s.showSeconds;
      if (s.hour24 !== undefined) hour24 = !!s.hour24;
      if (s.analogDetail !== undefined) analogDetail = !!s.analogDetail;
      if (s.analogStyle !== undefined) analogStyle = clamp(s.analogStyle | 0, 0, 2);
    } catch (e) {
    }
  }

  function saveSettings() {
    if (!settingsDirty) return;
    try {
      require("fs").writeFileSync("USER/CLOCKSUITE.SET", JSON.stringify({
        clockLayout: clockLayout,
        showSeconds: showSeconds,
        hour24: hour24,
        analogDetail: analogDetail,
        analogStyle: analogStyle
      }));
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
    var start = transitionUtc(y, 2, nthSunday(y, 2, 2), 2, std);
    var end = transitionUtc(y, 10, nthSunday(y, 10, 1), 2, std + 60);
    return utc >= start && utc < end;
  }

  function isDstEu(utc) {
    var y = (new Date(utc)).getUTCFullYear();
    var start = Date.UTC(y, 2, lastSunday(y, 2), 1, 0, 0);
    var end = Date.UTC(y, 9, lastSunday(y, 9), 1, 0, 0);
    return utc >= start && utc < end;
  }

  function isDstAus(utc, std) {
    var y = (new Date(utc + (std * 60000))).getUTCFullYear();
    var start = transitionUtc(y, 9, nthSunday(y, 9, 1), 2, std);
    var end = transitionUtc(y, 3, nthSunday(y, 3, 1), 3, std + 60);
    return utc >= start || utc < end;
  }

  function isDstNz(utc, std) {
    var y = (new Date(utc + (std * 60000))).getUTCFullYear();
    var start = transitionUtc(y, 8, lastSunday(y, 8), 2, std);
    var end = transitionUtc(y, 3, nthSunday(y, 3, 1), 3, std + 60);
    return utc >= start || utc < end;
  }

  function zoneIsDst(zone, utc) {
    if (zone.rule === "us") return isDstUs(utc, zone.std);
    if (zone.rule === "eu") return isDstEu(utc);
    if (zone.rule === "aus") return isDstAus(utc, zone.std);
    if (zone.rule === "nz") return isDstNz(utc, zone.std);
    return false;
  }

  function zoneOffset(zone, utc) {
    return zone.std + (zoneIsDst(zone, utc) ? 60 : 0);
  }

  function zoneAbbr(zone, utc) {
    return zoneIsDst(zone, utc) && zone.dst ? zone.dst : zone.abbr;
  }

  function formatOffset(minutes) {
    if (minutes === 0) return "UTC";
    return "UTC" + (minutes > 0 ? "+" : "-") + pad2(Math.floor(Math.abs(minutes) / 60)) + ":" + pad2(Math.abs(minutes) % 60);
  }

  function zoneDate(zone, utc) {
    return new Date(utc + (zoneOffset(zone, utc) * 60000));
  }

  function formatDateLocal(d) {
    return dayNames[d.getDay()] + " " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatDateUtc(d) {
    return dayNames[d.getUTCDay()] + " " + d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
  }

  function formatLongDateLocal(d) {
    return fullDayNames[d.getDay()] + ", " + monthNames[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function formatLongDateUtc(d) {
    return fullDayNames[d.getUTCDay()] + ", " + monthNames[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }

  function wrapLon(lon) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return lon;
  }

  function formatFix(lat, lon) {
    lat = Math.round(lat);
    lon = Math.round(wrapLon(lon));
    var ns = lat === 0 ? "" : (lat < 0 ? "S" : "N");
    var ew = lon === 0 ? "" : (lon < 0 ? "W" : "E");
    return Math.abs(lat) + ns + " " + Math.abs(lon) + ew;
  }

  function formatTimeParts(h, m, s, secs, h24) {
    var suffix = "";
    if (!h24) {
      suffix = h >= 12 ? " PM" : " AM";
      h = h % 12;
      if (h === 0) h = 12;
    }
    return pad2(h) + ":" + pad2(m) + (secs ? ":" + pad2(s) : "") + suffix;
  }

  function formatLocalTime(d, secs) {
    return formatTimeParts(d.getHours(), d.getMinutes(), d.getSeconds(), secs, hour24);
  }

  function formatUtcTime(d, secs) {
    return formatTimeParts(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), secs, true);
  }

  function localOffsetText() {
    var d = new Date();
    if (!d.getTimezoneOffset) return "LOCAL";
    return formatOffset(-d.getTimezoneOffset());
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s);
  }

  function formatMs(ms) {
    ms = Math.max(0, Math.floor(ms));
    var total = Math.floor(ms / 1000);
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var t = Math.floor((ms % 1000) / 100);
    return h > 0 ? pad2(h) + ":" + pad2(m) + ":" + pad2(s) : pad2(m) + ":" + pad2(s) + "." + t;
  }

  function line(x1, y1, x2, y2) {
    screen.drawLine(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));
  }

  function drawBox(x, y, w, h) {
    screen.drawRect(x, y, x + w, y + h);
  }

  function drawHeader() {
    var w = width();
    screen.reset().clear();
    screen.setColor(3);
    setMono().setFontAlign(-1, -1).drawString("ROBCO CHRONOMETER", 8, 6);
    setMono().setFontAlign(1, -1).drawString(formatLocalTime(new Date(), false), w - 8, 6);
    screen.drawLine(0, 32, w, 32);
    setMono().setFontAlign(0, -1).drawString(modes[mode], w / 2, 36);
  }

  function drawFooter(left, right) {
    var w = width();
    var y = height() - 22;
    screen.setColor(1);
    screen.drawLine(0, y - 7, w, y - 7);
    setMono().setFontAlign(-1, -1).drawString(left, 8, y);
    setMono().setFontAlign(1, -1).drawString(right, w - 8, y);
  }

  function drawStatusRail(x, y, title, rows) {
    var rw = width() - x - 12;
    var i;
    screen.setColor(1);
    drawBox(x, y, rw, 154);
    setMono().setFontAlign(0, -1).drawString(title, x + (rw / 2), y + 8);
    for (i = 0; i < rows.length; i++) {
      setMono().setFontAlign(-1, -1).drawString(rows[i], x + 10, y + 38 + (i * 24));
    }
  }

  function drawClock() {
    var w = width();
    var d = new Date();
    var time = formatLocalTime(d, showSeconds);
    drawHeader();

    screen.setColor(3);
    if (clockLayout === 0) {
      setVector(showSeconds ? 54 : 72).setFontAlign(0, 0).drawString(time, w / 2, 145);
      setMono().setFontAlign(0, -1).drawString("VAULT-TEC LOCAL TIME", w / 2, 215);
    } else {
      setVector(showSeconds ? 46 : 62).setFontAlign(0, 0).drawString(time, 172, 132);
      if (clockLayout >= 1) {
        setMono().setFontAlign(0, -1).drawString(formatDateLocal(d), 172, 180);
      }
      if (clockLayout >= 2) {
        screen.setColor(1);
        setMono().setFontAlign(0, -1).drawString("PIP-BOY RTC  " + localOffsetText(), 172, 210);
      }
      if (clockLayout >= 3) {
        setMono().setFontAlign(0, -1).drawString("VAULT STATUS: NOMINAL", 172, 236);
      }
      drawStatusRail(326, 78, "DISPLAY", [
        "LAYOUT " + layoutNames[clockLayout],
        "SECS " + (showSeconds ? "ON" : "OFF"),
        "FMT " + (hour24 ? "24H" : "12H"),
        "ROBCO UI"
      ]);
    }

    drawFooter("K1 LAYOUT/SEC", "K2 12H/MODE");
  }

  function drawWorld() {
    var w = width();
    var utc = nowMs();
    var now = new Date();
    var selected = worldZones[worldIndex];
    var i;
    drawHeader();

    screen.setColor(3);
    setVector(40).setFontAlign(0, 0).drawString(formatLocalTime(now, true), 118, 120);
    setMono().setFontAlign(0, -1).drawString("LOCAL VAULT CLOCK", 118, 164);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(formatDateLocal(now), 118, 190);
    setMono().setFontAlign(0, -1).drawString(localOffsetText(), 118, 216);
    setMono().setFontAlign(0, -1).drawString(selected.name + " " + zoneAbbr(selected, utc), 118, 242);
    setMono().setFontAlign(0, -1).drawString(formatOffset(zoneOffset(selected, utc)) + " " + (zoneIsDst(selected, utc) ? "SUMMER" : "STANDARD"), 118, 266);

    screen.setColor(1);
    line(242, 66, 242, height() - 38);
    setMono().setFontAlign(-1, -1).drawString("WASTELAND RELAY", 260, 66);

    for (i = 0; i < 5; i++) {
      var zone = worldZones[(worldIndex + i) % worldZones.length];
      var d = zoneDate(zone, utc);
      var y = 98 + (i * 36);
      screen.setColor(i === 0 ? 3 : 1);
      setMono().setFontAlign(-1, 0).drawString(zone.name, 260, y);
      setMono().setFontAlign(0, 0).drawString(zoneAbbr(zone, utc), 344, y);
      setMono().setFontAlign(1, 0).drawString(formatUtcTime(d, false), w - 14, y);
    }

    drawFooter("K1 ZONES", "K2 MODE");
  }

  // Oblique orthographic projection: viewpoint over (centerLat, centerLon).
  // Returns screen point, or undefined if the point is on the far hemisphere.
  function geoProject(cx, cy, r, centerLat, centerLon, lon, lat) {
    var dlon = wrapLon(lon - centerLon) * Math.PI / 180;
    var phi = lat * Math.PI / 180;
    var p0 = centerLat * Math.PI / 180;
    var cosc = Math.sin(p0) * Math.sin(phi) + Math.cos(p0) * Math.cos(phi) * Math.cos(dlon);
    if (cosc < 0) return undefined;
    return {
      x: cx + (r * Math.cos(phi) * Math.sin(dlon)),
      y: cy - (r * ((Math.cos(p0) * Math.sin(phi)) - (Math.sin(p0) * Math.cos(phi) * Math.cos(dlon))))
    };
  }

  function drawGeoPath(cx, cy, r, centerLat, centerLon, pts) {
    var i;
    var last;
    for (i = 0; i < pts.length; i += 2) {
      var p = geoProject(cx, cy, r, centerLat, centerLon, pts[i], pts[i + 1]);
      if (p && last) line(last.x, last.y, p.x, p.y);
      last = p;
    }
  }

  function drawMeridian(cx, cy, r, centerLat, centerLon, lon) {
    var lat;
    var last;
    for (lat = -90; lat <= 90; lat += 6) {
      var p = geoProject(cx, cy, r, centerLat, centerLon, lon, lat);
      if (p && last) line(last.x, last.y, p.x, p.y);
      last = p;
    }
  }

  function drawParallel(cx, cy, r, centerLat, centerLon, lat) {
    var lon;
    var last;
    for (lon = centerLon - 180; lon <= centerLon + 180; lon += 6) {
      var p = geoProject(cx, cy, r, centerLat, centerLon, lon, lat);
      if (p && last) line(last.x, last.y, p.x, p.y);
      last = p;
    }
  }

  // Approximate solar declination (radians) for a UTC instant.
  function solarDeclination(utc) {
    var d = new Date(utc);
    var n = Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1;
    return -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI * (n + 10) / 365.24);
  }

  // Longitude where the sun is overhead (local mean solar noon).
  function subSolarLon(utc) {
    var d = new Date(utc);
    var ut = d.getUTCHours() + (d.getUTCMinutes() / 60) + (d.getUTCSeconds() / 3600);
    return wrapLon((12 - ut) * 15);
  }

  // Unit vector toward the sub-solar point, expressed in view space for the
  // current globe centre: x = east (screen +x), y = north (screen up),
  // z = depth toward the viewer. A surface point's solar elevation sine is
  // simply the dot of its view-space unit vector with this.
  function subSolarVector(centerLat, centerLon, utc) {
    var dec = solarDeclination(utc);
    var dl = wrapLon(subSolarLon(utc) - centerLon) * Math.PI / 180;
    var p0 = centerLat * Math.PI / 180;
    return {
      x: Math.cos(dec) * Math.sin(dl),
      y: (Math.cos(p0) * Math.sin(dec)) - (Math.sin(p0) * Math.cos(dec) * Math.cos(dl)),
      z: (Math.sin(p0) * Math.sin(dec)) + (Math.cos(p0) * Math.cos(dec) * Math.cos(dl))
    };
  }

  // Along the disc line where the fixed in-plane coordinate is "av", returns the
  // intervals of the free coordinate where the solar elevation sine is at or below
  // t. pa/pb are the sun's components on the fixed/free axes, pd on the depth axis.
  // Exact: solves the terminator conic, then classifies each sub-interval by the
  // true value at its midpoint (so spurious roots from squaring are harmless).
  function darkSpan(av, pa, pb, pd, t) {
    var bmax = Math.sqrt(Math.max(0, 1 - (av * av)));
    if (bmax <= 0) return [];
    var bounds = [-bmax, bmax];
    var a = (pb * pb) + (pd * pd);
    if (a > 1e-9) {
      var k = t - (av * pa);
      var b = -2 * k * pb;
      var c = (k * k) - (pd * pd * (1 - (av * av)));
      // Clamp the discriminant: near the tangent case (sun on the local horizon,
      // terminator through the disc centre) rounding can push it slightly below
      // zero. Any extra split point is harmless since each sub-interval is
      // classified by the true elevation at its midpoint below.
      var sq = Math.sqrt(Math.max(0, (b * b) - (4 * a * c)));
      var b1 = (-b - sq) / (2 * a);
      var b2 = (-b + sq) / (2 * a);
      if (b1 > -bmax && b1 < bmax) bounds.push(b1);
      if (b2 > -bmax && b2 < bmax) bounds.push(b2);
    }
    bounds.sort(function(p, q) { return p - q; });
    var segs = [];
    var i;
    for (i = 0; i < bounds.length - 1; i++) {
      var lo = bounds[i];
      var hi = bounds[i + 1];
      if (hi - lo < 1e-4) continue;
      var mid = (lo + hi) / 2;
      var w = Math.sqrt(Math.max(0, 1 - (av * av) - (mid * mid)));
      if (((av * pa) + (mid * pb) + (w * pd)) <= t) segs.push([lo, hi]);
    }
    return segs;
  }

  // Dim scanline wash over the night hemisphere. The terminator curves and tilts
  // with the season because it is derived from the true sub-solar direction rather
  // than a meridian. Horizontal rows keep it distinct from the vertical graticule.
  function drawGlobeShade(cx, cy, r, s) {
    var yv;
    var i;
    screen.setColor(1);
    for (yv = -r + 1; yv < r; yv += 2) {
      var segs = darkSpan(yv / r, s.y, s.x, s.z, 0);
      for (i = 0; i < segs.length; i++) {
        line(cx + (segs[i][0] * r), cy - yv, cx + (segs[i][1] * r), cy - yv);
      }
    }
  }

  // The day/night boundary is the great circle whose pole is the sub-solar point:
  // trace it directly in view space and draw the near-side arc.
  function drawTerminator(cx, cy, r, s) {
    var ax = -s.z;
    var ay = 0;
    var az = s.x;
    var m = Math.sqrt((ax * ax) + (az * az));
    if (m < 1e-6) { ax = 1; ay = 0; az = 0; m = 1; }
    ax /= m; az /= m;
    var bx = (s.y * az) - (s.z * ay);
    var by = (s.z * ax) - (s.x * az);
    var bz = (s.x * ay) - (s.y * ax);
    var last;
    var th;
    screen.setColor(3);
    for (th = 0; th <= 360; th += 6) {
      var c = Math.cos(th * Math.PI / 180);
      var sn = Math.sin(th * Math.PI / 180);
      var pz = (az * c) + (bz * sn);
      var p = pz < 0 ? undefined : {
        x: cx + (((ax * c) + (bx * sn)) * r),
        y: cy - (((ay * c) + (by * sn)) * r)
      };
      if (p && last) line(last.x, last.y, p.x, p.y);
      last = p;
    }
  }

  // Sub-solar point ("high noon" / sun directly overhead) when on the near side.
  function drawSunMarker(cx, cy, r, s) {
    if (s.z <= 0) return;
    var mx = cx + (s.x * r);
    var my = cy - (s.y * r);
    var i;
    screen.setColor(3);
    screen.drawCircle(mx, my, 2);
    for (i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI;
      line(mx - (Math.cos(a) * 8), my - (Math.sin(a) * 8), mx + (Math.cos(a) * 8), my + (Math.sin(a) * 8));
    }
  }

  // "You are here" marker at the selected location (globe centre).
  function drawHomeMarker(cx, cy) {
    screen.setColor(3);
    screen.drawCircle(cx, cy, 5);
    line(cx - 9, cy, cx - 3, cy);
    line(cx + 3, cy, cx + 9, cy);
    line(cx, cy - 9, cx, cy - 3);
    line(cx, cy + 3, cx, cy + 9);
  }

  function drawGlobeGrid(cx, cy, r, centerLat, centerLon) {
    var i;
    screen.setColor(3);
    screen.drawCircle(cx, cy, r);
    screen.drawCircle(cx, cy, r - 2);
    screen.setColor(1);
    for (i = -60; i <= 60; i += 30) {
      drawParallel(cx, cy, r, centerLat, centerLon, i);
    }
    for (i = -180; i < 180; i += 30) {
      drawMeridian(cx, cy, r, centerLat, centerLon, i);
    }
  }

  function drawTimezoneBand(cx, cy, r, centerLat, centerLon, offsetMinutes) {
    var central = wrapLon((offsetMinutes / 60) * 15);
    screen.setColor(1);
    drawMeridian(cx, cy, r, centerLat, centerLon, central - 7.5);
    drawMeridian(cx, cy, r, centerLat, centerLon, central + 7.5);
  }

  function drawGlobeLand(cx, cy, r, centerLat, centerLon) {
    var i;
    screen.setColor(3);
    for (i = 0; i < landShapes.length; i++) {
      drawGeoPath(cx, cy, r, centerLat, centerLon, landShapes[i]);
    }
  }

  function drawGlobe() {
    var utc = nowMs();
    var zone = worldZones[worldIndex];
    var zd = zoneDate(zone, utc);
    var cx = 150;
    var cy = 166;
    var r = 104;
    var centerLon = zone.lon || 0;
    var centerLat = zone.lat || 0;
    var sun = subSolarVector(centerLat, centerLon, utc);
    // Selected location sits at the disc centre, so its solar elevation is the
    // viewer-facing component of the sub-solar vector.
    var elev = Math.asin(Math.max(-1, Math.min(1, sun.z))) * 180 / Math.PI;
    var phase = elev >= 0 ? "DAYLIGHT" : (elev >= -12 ? "TWILIGHT" : "NIGHT");

    drawHeader();
    drawGlobeShade(cx, cy, r, sun);
    drawGlobeGrid(cx, cy, r, centerLat, centerLon);
    drawTimezoneBand(cx, cy, r, centerLat, centerLon, zoneOffset(zone, utc));
    drawGlobeLand(cx, cy, r, centerLat, centerLon);
    drawTerminator(cx, cy, r, sun);
    drawSunMarker(cx, cy, r, sun);
    drawHomeMarker(cx, cy);

    screen.setColor(3);
    setMono().setFontAlign(0, -1).drawString("ROBCO ORBITAL RELAY", 348, 72);
    screen.setColor(1);
    drawBox(272, 96, 158, 184);
    setMono().setFontAlign(0, -1).drawString(zone.name + " " + zoneAbbr(zone, utc), 351, 112);
    setVector(30).setFontAlign(0, 0).drawString(formatUtcTime(zd, false), 351, 154);
    setMono().setFontAlign(0, -1).drawString(formatLongDateUtc(zd).split(", ")[0], 351, 188);
    setMono().setFontAlign(0, -1).drawString(monthNames[zd.getUTCMonth()] + " " + zd.getUTCDate() + ", " + zd.getUTCFullYear(), 351, 212);
    setMono().setFontAlign(0, -1).drawString("FIX " + formatFix(centerLat, centerLon), 351, 236);
    screen.setColor(elev >= 0 ? 3 : 1);
    setMono().setFontAlign(0, -1).drawString(phase + " " + (elev >= 0 ? "+" : "-") + Math.round(Math.abs(elev)), 351, 260);

    drawFooter("K1 ZONES", "K2 MODE");
  }

  function drawAnalogFace(cx, cy, r) {
    var i;
    screen.setColor(analogStyle === 1 ? 1 : 3);
    screen.drawCircle(cx, cy, r);
    if (analogStyle !== 2) screen.drawCircle(cx, cy, r - 6);

    for (i = 0; i < 60; i++) {
      var a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      var major = i % 5 === 0;
      var r1 = r - (major ? 13 : 7);
      var x1 = cx + Math.cos(a) * r1;
      var y1 = cy + Math.sin(a) * r1;
      var x2 = cx + Math.cos(a) * (r - 2);
      var y2 = cy + Math.sin(a) * (r - 2);
      screen.setColor(major ? 3 : 1);
      line(x1, y1, x2, y2);
    }

    screen.setColor(1);
    setMono().setFontAlign(0, 0).drawString("12", cx, cy - r + 28);
    setMono().setFontAlign(0, 0).drawString("3", cx + r - 30, cy);
    setMono().setFontAlign(0, 0).drawString("6", cx, cy + r - 30);
    setMono().setFontAlign(0, 0).drawString("9", cx - r + 30, cy);
  }

  function drawHand(cx, cy, angle, len) {
    line(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
  }

  function drawAnalog() {
    var d = new Date();
    var dateDay = fullDayNames[d.getDay()];
    var dateRest = monthNames[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
    var cx = 150;
    var cy = 162;
    var r = 100;
    var h = d.getHours() % 12;
    var m = d.getMinutes();
    var s = d.getSeconds();
    var hourAngle = (((h + (m / 60)) / 12) * Math.PI * 2) - Math.PI / 2;
    var minuteAngle = (((m + (s / 60)) / 60) * Math.PI * 2) - Math.PI / 2;
    var secondAngle = ((s / 60) * Math.PI * 2) - Math.PI / 2;

    drawHeader();
    drawAnalogFace(cx, cy, r);
    screen.setColor(3);
    drawHand(cx, cy, hourAngle, 48);
    drawHand(cx, cy, minuteAngle, 74);
    screen.setColor(1);
    drawHand(cx, cy, secondAngle, 86);
    screen.drawCircle(cx, cy, 4);

    screen.setColor(1);
    drawBox(274, 76, 164, 174);
    line(286, 90, 426, 90);
    line(286, 232, 426, 232);
    setMono().setFontAlign(0, -1).drawString("VAULT-TEC", 356, 98);
    setMono().setFontAlign(0, -1).drawString("CERTIFIED DATE", 356, 122);
    if (analogDetail) {
      screen.setColor(3);
      setMono().setFontAlign(0, -1).drawString(dateDay, 356, 156);
      setMono().setFontAlign(0, -1).drawString(dateRest, 356, 184);
      screen.setColor(1);
      setMono().setFontAlign(0, -1).drawString("FACE " + (analogStyle + 1) + "  SIGNAL OK", 356, 214);
    } else {
      setMono().setFontAlign(0, -1).drawString("DATE REDACTED", 356, 166);
      setMono().setFontAlign(0, -1).drawString("FACE " + (analogStyle + 1), 356, 198);
    }

    drawFooter("K1 FACE/DATA", "K2 MODE");
  }

  function stopwatchMs() {
    return stopwatchElapsed + (stopwatchRunning ? nowMs() - stopwatchStart : 0);
  }

  function toggleStopwatch() {
    if (stopwatchRunning) {
      stopwatchElapsed = stopwatchMs();
      stopwatchRunning = false;
    } else {
      stopwatchStart = nowMs();
      stopwatchRunning = true;
    }
    sound("OK");
  }

  function resetStopwatch() {
    stopwatchRunning = false;
    stopwatchStart = 0;
    stopwatchElapsed = 0;
    stopwatchLap = -1;
    sound("PREV");
  }

  function drawStopwatch() {
    drawHeader();
    screen.setColor(3);
    setVector(58).setFontAlign(0, 0).drawString(formatMs(stopwatchMs()), 238, 130);
    setMono().setFontAlign(0, -1).drawString(stopwatchRunning ? "FIELD TEST RUNNING" : "FIELD TEST STOPPED", 238, 190);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString(stopwatchLap >= 0 ? "LAP  " + formatMs(stopwatchLap) : "LAP  --:--.-", 238, 224);
    drawFooter("K1 START/LAP", "K2 RESET/MODE");
  }

  function countdownCurrent() {
    if (!countdownRunning) return countdownRemaining;
    return Math.max(0, Math.ceil((countdownEnd - nowMs()) / 1000));
  }

  function toggleCountdown() {
    if (countdownRunning) {
      countdownRemaining = countdownCurrent();
      countdownRunning = false;
    } else {
      if (countdownRemaining <= 0) countdownRemaining = countdownSet;
      countdownEnd = nowMs() + (countdownRemaining * 1000);
      countdownRunning = true;
    }
    sound("OK");
  }

  function resetCountdown() {
    countdownRunning = false;
    countdownRemaining = countdownSet;
    sound("PREV");
  }

  function adjustCountdown(dir) {
    if (countdownRunning) return;
    countdownSet = clamp(countdownSet + (dir * 60), 60, 99 * 60);
    countdownRemaining = countdownSet;
    sound("CLICK");
  }

  function updateCountdown() {
    if (countdownRunning && countdownCurrent() <= 0) {
      countdownRunning = false;
      countdownRemaining = 0;
      sound("OK2");
    }
  }

  function drawCountdown() {
    drawHeader();
    screen.setColor(3);
    setVector(64).setFontAlign(0, 0).drawString(formatDuration(countdownCurrent()), 238, 130);
    setMono().setFontAlign(0, -1).drawString(countdownRunning ? "RADSAFE COUNTDOWN ACTIVE" : "SET " + formatDuration(countdownSet), 238, 196);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString("ADJUSTMENT: ONE MINUTE STEPS", 238, 230);
    drawFooter("K1 START/ADJ", "K2 RESET/MODE");
  }

  function pomoCurrent() {
    if (!pomoRunning) return pomoRemaining;
    return Math.max(0, Math.ceil((pomoEnd - nowMs()) / 1000));
  }

  function nextPomoPhase(autoStart) {
    if (pomoPhase === 0) {
      pomoCycles++;
      pomoPhase = 1;
      pomoRemaining = pomoBreak;
    } else {
      pomoPhase = 0;
      pomoRemaining = pomoWork;
    }
    pomoRunning = !!autoStart;
    if (pomoRunning) pomoEnd = nowMs() + (pomoRemaining * 1000);
  }

  function togglePomo() {
    if (pomoRunning) {
      pomoRemaining = pomoCurrent();
      pomoRunning = false;
    } else {
      if (pomoRemaining <= 0) pomoRemaining = pomoPhase === 0 ? pomoWork : pomoBreak;
      pomoEnd = nowMs() + (pomoRemaining * 1000);
      pomoRunning = true;
    }
    sound("OK");
  }

  function resetPomo() {
    pomoRunning = false;
    pomoPhase = 0;
    pomoRemaining = pomoWork;
    pomoCycles = 0;
    sound("PREV");
  }

  function adjustPomo(dir) {
    if (pomoRunning) return;
    if (pomoPhase === 0) {
      pomoWork = clamp(pomoWork + (dir * 60), 5 * 60, 60 * 60);
      pomoRemaining = pomoWork;
    } else {
      pomoBreak = clamp(pomoBreak + (dir * 60), 1 * 60, 30 * 60);
      pomoRemaining = pomoBreak;
    }
    sound("CLICK");
  }

  function updatePomo() {
    if (pomoRunning && pomoCurrent() <= 0) {
      sound("OK2");
      nextPomoPhase(true);
    }
  }

  function drawPomodoro() {
    var phaseName = pomoPhase === 0 ? "WORK RATION" : "RECOVERY";
    drawHeader();
    screen.setColor(3);
    setVector(64).setFontAlign(0, 0).drawString(formatDuration(pomoCurrent()), 238, 125);
    setMono().setFontAlign(0, -1).drawString(phaseName + (pomoRunning ? " ACTIVE" : " READY"), 238, 190);
    screen.setColor(1);
    setMono().setFontAlign(0, -1).drawString("CYCLES " + pomoCycles + "  WORK " + formatDuration(pomoWork) + "  BREAK " + formatDuration(pomoBreak), 238, 225);
    drawFooter("K1 START/ADJ", "K2 RESET/MODE");
  }

  function draw() {
    if (!screen) return;
    if (mode === 0) drawClock();
    else if (mode === 1) drawWorld();
    else if (mode === 2) drawGlobe();
    else if (mode === 3) drawAnalog();
    else if (mode === 4) drawStopwatch();
    else if (mode === 5) drawCountdown();
    else drawPomodoro();
    if (screen.flip) screen.flip();
  }

  function rotateMode(dir) {
    mode = wrap(mode + dir, modes.length);
    sound("COLUMN");
  }

  function markSettingsDirty() {
    settingsDirty = true;
  }

  function onKnob1(dir) {
    if (mode === 0) {
      if (dir === 0) {
        showSeconds = !showSeconds;
      } else {
        clockLayout = wrap(clockLayout + dir, layoutNames.length);
      }
      markSettingsDirty();
      sound("CLICK");
    } else if (mode === 1) {
      if (dir !== 0) {
        worldIndex = wrap(worldIndex + dir, worldZones.length);
        sound("CLICK");
      } else {
        sound("OK");
      }
    } else if (mode === 2) {
      if (dir !== 0) {
        worldIndex = wrap(worldIndex + dir, worldZones.length);
        sound("CLICK");
      } else {
        sound("OK");
      }
    } else if (mode === 3) {
      if (dir === 0) {
        analogDetail = !analogDetail;
      } else {
        analogStyle = wrap(analogStyle + dir, 3);
      }
      markSettingsDirty();
      sound("CLICK");
    } else if (mode === 4) {
      if (dir === 0) toggleStopwatch();
      else if (stopwatchRunning) stopwatchLap = stopwatchMs();
      else resetStopwatch();
    } else if (mode === 5) {
      if (dir === 0) toggleCountdown();
      else adjustCountdown(dir);
    } else if (mode === 6) {
      if (dir === 0) togglePomo();
      else adjustPomo(dir);
    }
    draw();
  }

  function onKnob2(dir) {
    if (dir === 0) {
      if (mode === 0) {
        hour24 = !hour24;
        markSettingsDirty();
        sound("OK");
      } else if (mode === 4) {
        resetStopwatch();
      } else if (mode === 5) {
        resetCountdown();
      } else if (mode === 6) {
        resetPomo();
      } else {
        sound("OK");
      }
    } else {
      rotateMode(dir);
    }
    draw();
  }

  function tick() {
    updateCountdown();
    updatePomo();
    draw();
  }

  loadSettings();

  if (typeof Pip !== "undefined") {
    Pip.on("knob1", onKnob1);
    Pip.on("knob2", onKnob2);
  }

  ticker = setInterval(tick, 500);
  draw();

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
