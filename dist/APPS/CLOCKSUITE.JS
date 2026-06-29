(function() {
var appId = "ROBCLOCK";
var screen = (typeof h !== "undefined") ? h : ((typeof g !== "undefined") ? g : undefined);
var ticker;
var dirty = false;
var MARGIN = 32;
var clockLayout = 1;
var showSeconds = true;
var hour24 = true;
var locked = false;
var days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
var layouts = ["TIME", "DATE", "FIELD", "VAULT"];
function pad2(n) {
n = Math.floor(Math.abs(n));
return n < 10 ? "0" + n : "" + n;
}
function wrap(n, max) {
n = n % max;
return n < 0 ? n + max : n;
}
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
function formatTime(d, secs) {
var h = d.getHours();
var suffix = "";
if (!hour24) {
suffix = h >= 12 ? " PM" : " AM";
h = h % 12;
if (h === 0) h = 12;
}
return pad2(h) + ":" + pad2(d.getMinutes()) + (secs ? ":" + pad2(d.getSeconds()) : "") + suffix;
}
function formatDate(d) {
return days[d.getDay()] + " " + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}
function formatOffset() {
var d = new Date();
var m = d.getTimezoneOffset ? -d.getTimezoneOffset() : 0;
if (m === 0) return "UTC";
return "UTC" + (m > 0 ? "+" : "-") + pad2(Math.floor(Math.abs(m) / 60)) + ":" + pad2(Math.abs(m) % 60);
}
function loadSettings() {
try {
var p = String(require("fs").readFileSync("USER/ROBCLOCK.SET")).split(",");
if (p.length >= 3) {
clockLayout = Math.max(0, Math.min(3, p[0] | 0));
showSeconds = p[1] !== "0";
hour24 = p[2] !== "0";
}
if (p.length >= 4) locked = p[3] !== "0";
} catch (e) {
}
}
function saveSettings() {
if (!dirty) return;
try {
require("fs").writeFileSync("USER/ROBCLOCK.SET", [clockLayout, showSeconds ? 1 : 0, hour24 ? 1 : 0, locked ? 1 : 0].join(","));
} catch (e) {
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
drawFit(formatTime(d, false), w - MARGIN, 12, 112, 1);
drawFit("> CHRONOMETER CONTROL", MARGIN, 47, 282, -1);
screen.setColor(1);
drawFit("MODE " + layouts[clockLayout], w - MARGIN, 47, 152, 1);
}
function drawFooter() {
var w = screen.getWidth ? screen.getWidth() : 480;
var hgt = screen.getHeight ? screen.getHeight() : 320;
screen.setColor(1);
screen.drawLine(MARGIN, hgt - 40, w - MARGIN, hgt - 40);
setVector(14);
screen.setColor(1);
drawFit("K1 LAYOUT  K2 FMT", MARGIN, hgt - 31, 218, -1);
screen.setColor(locked ? 3 : 1);
drawFit(locked ? "LOCKED  K1 UNLOCK" : "K1 LOCK", w - MARGIN, hgt - 31, 218, 1);
}
function drawRail() {
screen.setColor(1);
screen.drawRect(306, 78, 454, 252);
screen.drawLine(306, 102, 454, 102);
setMono();
drawFit("CONFIG 0x7A1", 380, 84, 136, 0);
drawFit("> MODE " + layouts[clockLayout], 318, 116, 124, -1);
drawFit("> SEC " + (showSeconds ? "ENABLED" : "DISABLED"), 318, 140, 124, -1);
drawFit("> FMT " + (hour24 ? "24-HOUR" : "12-HOUR"), 318, 164, 124, -1);
drawFit("RTC [====] OK", 318, 196, 124, -1);
drawFit("LOCK " + (locked ? "ENGAGED" : "OPEN"), 318, 220, 124, -1);
}
function draw() {
if (!screen) return;
var d = new Date();
var w = screen.getWidth ? screen.getWidth() : 480;
drawHeader(d);
screen.setColor(3);
if (clockLayout === 0) {
screen.setColor(1);
screen.drawRect(42, 86, w - 43, 244);
screen.drawLine(42, 112, w - 43, 112);
setMono();
drawFit("LOCAL TIMEBASE 0xC1A0", w / 2, 92, w - 96, 0);
screen.setColor(3);
drawVectorFit(formatTime(d, showSeconds), w / 2, 148, w - (MARGIN * 2), showSeconds ? 54 : 72, 36, 0);
screen.setColor(1);
setMono();
drawFit("SYNC [========] VAULT RTC", w / 2, 216, w - (MARGIN * 2), 0);
} else {
screen.setColor(1);
screen.drawRect(42, 78, 292, 252);
screen.drawLine(42, 102, 292, 102);
setMono();
drawFit("ADDR 0xF4F0", 54, 84, 100, -1);
drawFit("LOCAL TIMEBASE", 280, 84, 136, 1);
screen.setColor(3);
drawVectorFit(formatTime(d, showSeconds), 172, 132, 238, showSeconds ? 46 : 62, 30, 0);
setMono();
drawFit(formatDate(d), 172, 180, 238, 0);
if (clockLayout >= 2) {
screen.setColor(1);
setMono();
drawFit("RTC BUS  " + formatOffset(), 172, 210, 238, 0);
}
if (clockLayout >= 3) {
setMono();
drawFit("TERMLINK STATUS NOMINAL", 172, 236, 238, 0);
}
drawRail();
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
function cycleDisplay() {
if (hour24 && showSeconds) { hour24 = true; showSeconds = false; }
else if (hour24 && !showSeconds) { hour24 = false; showSeconds = true; }
else if (!hour24 && showSeconds) { hour24 = false; showSeconds = false; }
else { hour24 = true; showSeconds = true; }
}
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
clockLayout = wrap(clockLayout + dir, layouts.length);
dirty = true;
sound("CLICK");
safeDraw();
}
function onKnob2(dir) {
if (locked) return;
cycleDisplay();
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
