import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const logos = JSON.parse(fs.readFileSync(path.join(root, "data/domestic_code_logos.json"), "utf8")).codes;
const dir = path.join(root, "public/logos/stock");
const out = {};

for (const [, stem] of Object.entries(logos)) {
  const file = path.join(dir, `${stem}.svg`);
  if (!fs.existsSync(file)) continue;
  const svg = fs.readFileSync(file, "utf8");
  const fills = [...svg.matchAll(/fill="(#[0-9A-Fa-f]{3,8})"/g)]
    .map((m) => m[1].toUpperCase())
    .filter((c) => !["#FFF", "#FFFFFF", "#000", "#000000", "#NONE"].includes(c));
  if (fills.length) out[stem] = fills[0];
}

fs.writeFileSync(
  path.join(root, "data/logo-brand-colors.json"),
  `${JSON.stringify({ updated: "auto", colors: out }, null, 2)}\n`,
);
console.log(`logo brand colors: ${Object.keys(out).length}`);
