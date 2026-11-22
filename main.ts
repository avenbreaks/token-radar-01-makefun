// Token launch radar: reads the sealed snapshot, ranks the pre-token
// protocols by implied value, and writes the board, the dashboard data,
// the dashboard and screenshots, and the dossier.
// Node 22, standard library only. Deterministic: two runs write the same
// bytes (no clock, no randomness; every order is fixed by the sort).
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBoard } from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

const root = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const inputPath = arg("--input", "/input/snapshot.json");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const skipDossier = process.env.MAKEFUN_SKIP_DOSSIER === "1";

const snapshot = JSON.parse(readFileSync(inputPath, "utf8"));
const rows = buildBoard(snapshot, 200);

const board = {
  as_of: snapshot.as_of,
  source: snapshot.source,
  floor_usd: snapshot.floor_usd,
  rows,
};

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "dashboard"), { recursive: true });
mkdirSync(join(outDir, "screenshots"), { recursive: true });

writeFileSync(join(outDir, "board.json"), JSON.stringify(board, null, 2) + "\n", "utf8");
writeFileSync(join(outDir, "data.js"), "window.BOARD = " + JSON.stringify(board) + ";\n", "utf8");

cpSync(join(root, "dashboard"), join(outDir, "dashboard"), { recursive: true });
if (existsSync(join(root, "screenshots"))) {
  cpSync(join(root, "screenshots"), join(outDir, "screenshots"), { recursive: true });
}

if (!skipDossier) {
  writeFileSync(join(outDir, "dossier.json"), buildDossier(outDir, { text_max_bytes: 65536 }));
}

const watchlistCovered = snapshot.watchlist.every((s: string) =>
  rows.some((r) => r.slug === s),
);
console.log(`rows=${rows.length} watchlist_covered=${watchlistCovered} top=${rows[0].slug} $${rows[0].implied_value_usd} bottom=${rows[rows.length - 1].slug} $${rows[rows.length - 1].implied_value_usd}`);
console.log(`wrote ${resolve(outDir)}`);
