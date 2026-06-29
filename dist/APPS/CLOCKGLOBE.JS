(function() {
var appId = "ROBGLOBE";
var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
var ticker;
var MARGIN = 32;
var MS_PER_MIN = 60000;
var MS_PER_DAY = 86400000;
var worldIndex = 12;
var homeIndex = 12;
var locked = false;
var dirty = false;
var monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
var zones = [-720, -660, -600, -540, -480, -420, -360, -300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720, 780, 840];
var zoneNames = ["BAKER", "PAGO PAGO", "HONOLULU", "ANCHORAGE", "LOS ANGELES", "DENVER", "CHICAGO", "NEW YORK", "SANTIAGO", "BUENOS AIRES", "S. GEORGIA", "AZORES", "LONDON", "PARIS", "CAIRO", "MOSCOW", "DUBAI", "KARACHI", "DHAKA", "BANGKOK", "BEIJING", "TOKYO", "SYDNEY", "NOUMEA", "AUCKLAND", "APIA", "KIRITIMATI"];
var px = 0, py = 0, sunX = 0, sunY = 0, sunZ = 0;
var DEG = Math.PI / 180;
var landAt = 0;
var memLog = "";
var memLogged = false;
function memFree() {
try {
var m = process.memory();
return m.free + "/" + m.total;
} catch (e) {
return "n/a";
}
}
function logMem(tag) {
memLog += tag + " " + memFree() + " | ";
try {
require("fs").writeFileSync("GLOBE.MEM", memLog);
} catch (e) {
}
}
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
for (lon = ctrLon - 90; lon <= ctrLon + 90; lon += 15) {
if (project(cx, cy, r, lon, lat)) {
if (have) line(lx, ly, px, py);
lx = px; ly = py; have = true;
}
}
}
var land = "";
function loadLand() {
try {
land = String(require("fs").readFileSync("APPS/ROBGLOBE.LND"));
} catch (e) {
}
}
function readLandNum() {
var c, sign = 1, n = 0;
if (land.charCodeAt(landAt) === 45) {
sign = -1;
landAt++;
}
while (landAt < land.length) {
c = land.charCodeAt(landAt);
if (c < 48 || c > 57) break;
n = (n * 10) + c - 48;
landAt++;
}
if (land.charCodeAt(landAt) === 44) landAt++;
return sign * n;
}
function drawCoast(cx, cy, r) {
var lon, lat, c, have = false, lx = 0, ly = 0;
landAt = 0;
while (landAt < land.length) {
c = land.charCodeAt(landAt);
if (c === 59) {
have = false;
landAt++;
} else if ((c < 48 || c > 57) && c !== 45) {
landAt++;
} else {
lon = readLandNum();
lat = readLandNum();
if (project(cx, cy, r, lon, lat)) {
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
var dec = -23.44 * DEG * Math.cos(2 * Math.PI * (n + 10) / 365.24);
var ut = d.hour + (d.minute / 60) + (d.second / 3600);
var dl = wrapLon(((12 - ut) * 15) - centerLon) * DEG;
sunX = Math.cos(dec) * Math.sin(dl);
sunY = Math.sin(dec);
sunZ = Math.cos(dec) * Math.cos(dl);
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
for (th = 0; th <= 360; th += 10) {
var c = Math.cos(th * DEG);
var s = Math.sin(th * DEG);
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
drawFit("MEM " + memFree(), MARGIN, hgt - 31, 220, -1);
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
setVector(15);
drawFit("TZ RELAY // 0xA0", 351, 72, 156, 0);
screen.setColor(1);
screen.drawRect(272, 90, 430, 270);
screen.drawLine(272, 140, 430, 140);
setVector(18);
drawFit(label, 351, 97, 150, 0);
drawFit(place, 351, 118, 150, 0);
screen.setColor(3);
drawVectorFit(formatTime(zd), 351, 160, 150, 30, 22, 0);
screen.setColor(1);
setVector(18);
drawFit(monthNames[zd.month] + " " + zd.date, 351, 184, 150, 0);
drawFit("MERIDIAN " + formatLon(lon), 351, 206, 150, 0);
drawFit("BAND " + (zi + 1) + "/" + zones.length, 351, 228, 150, 0);
screen.setColor(elev >= 0 ? 3 : 1);
setVector(18);
drawFit(phase + " " + (elev >= 0 ? "+" : "-") + Math.round(Math.abs(elev)), 351, 250, 150, 0);
drawFooter();
if (screen.flip) screen.flip();
}
function safeDraw() {
try {
draw();
if (!memLogged) {
memLogged = true;
logMem("drawn");
}
} catch (e) {
}
}
function turnBand(dir) {
worldIndex = wrap(safeZone(worldIndex) + dir, zones.length);
dirty = true;
sound("CLICK");
safeDraw();
}
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
logMem("entry");
homeIndex = localZoneIndex();
worldIndex = homeIndex;
loadSettings();
loadLand();
logMem("loaded");
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
