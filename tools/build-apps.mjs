// Build step: produce stripped, device-bound copies of the app sources.
//
// The Pip-Boy launcher reads each APPS/*.JS file from the microSD card into RAM
// and evals it, so EVERY byte of source -- comments and indentation included --
// stays resident while the app runs. To keep the readable sources in the repo
// while shipping the smallest possible bytes, this script strips line comments
// and leading/trailing whitespace and writes the result to dist/APPS/. The
// installer fetches app JS from dist/ (see install.html); all other payload
// files (.info, .IMG, .LND) are shipped verbatim from their canonical paths.
//
// Run:  node tools/build-apps.mjs
//
// The stripper is deliberately conservative: it never removes code or string
// content and never joins lines (so automatic-semicolon-insertion behaviour is
// identical to the source). It relies on the suite invariant -- verified in the
// repo -- that the apps use only "// " line comments and single/double-quoted
// strings (no /* */ blocks, template literals, or regex literals).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "APPS");
const OUT_DIR = join(ROOT, "dist", "APPS");

// Remove a single line's comment and surrounding whitespace without ever
// touching characters inside a string literal.
function stripLine(line) {
  let out = "";
  let quote = null; // current string delimiter, or null when outside a string
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      out += c;
      if (c === "\\" && i + 1 < line.length) {
        out += line[i + 1]; // copy the escaped char verbatim
        i++;
      } else if (c === quote) {
        quote = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") {
      break; // rest of the line is a comment -- drop it
    }
    out += c;
  }
  return out.replace(/\s+$/, "").replace(/^\s+/, "");
}

function strip(src) {
  const out = [];
  for (const line of src.split(/\r?\n/)) {
    const s = stripLine(line);
    if (s !== "") out.push(s);
  }
  return out.join("\n") + "\n";
}

mkdirSync(OUT_DIR, { recursive: true });
const apps = readdirSync(SRC_DIR).filter((f) => /\.JS$/i.test(f));
let totalIn = 0;
let totalOut = 0;
let failures = 0;

for (const name of apps) {
  const src = readFileSync(join(SRC_DIR, name), "utf8");
  const built = strip(src);
  // Parse-check the output so a stripping mistake can never ship.
  try {
    new Function("return (" + built + ");");
  } catch (e) {
    console.error("  PARSE FAIL " + name + ": " + e.message);
    failures++;
    continue;
  }
  writeFileSync(join(OUT_DIR, name), built, "utf8");
  const inB = Buffer.byteLength(src, "utf8");
  const outB = Buffer.byteLength(built, "utf8");
  totalIn += inB;
  totalOut += outB;
  const pct = ((100 * (inB - outB)) / inB).toFixed(1);
  console.log(`  ${name.padEnd(18)} ${String(inB).padStart(6)} -> ${String(outB).padStart(6)} B  (-${pct}%)`);
}

console.log(
  `\ndist/APPS: ${apps.length - failures}/${apps.length} apps  ` +
    `${totalIn} -> ${totalOut} B  (-${((100 * (totalIn - totalOut)) / totalIn).toFixed(1)}%)`
);
if (failures) {
  console.error(`${failures} file(s) failed to parse -- not written.`);
  process.exit(1);
}
