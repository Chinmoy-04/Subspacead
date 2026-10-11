// Copies research outputs from ../results into the site so it can render
// without the Python API: results.json, ablation rows, and gallery figures
// cropped into separate input / ground-truth / prediction panels.
//
// Usage: npm run sync-assets

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESULTS = path.resolve(WEB, "..", "results");
const CONTENT = path.join(WEB, "src", "content");
const PUBLIC_GALLERY = path.join(WEB, "public", "gallery");
const PANELS = ["input", "gt", "pred"];
const MAX_SIDE = 720;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

function longestRun(flags) {
  let best = [0, 0];
  let start = -1;
  for (let i = 0; i <= flags.length; i++) {
    if (i < flags.length && flags[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      if (i - start > best[1] - best[0]) best = [start, i];
      start = -1;
    }
  }
  return best;
}

// Each figure is a matplotlib triplet on white: titles above three equal,
// evenly spaced panels. Photos can have near-white edges, so the box is
// measured on the colormapped prediction panel and reused for the others.
function panelBoxes(data, width, height, channels) {
  const isInk = (x, y) => {
    const i = (y * width + x) * channels;
    return data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248;
  };
  const third = Math.floor(width / 3);
  const measure = (col) => {
    const x0 = col * third;
    const x1 = col === 2 ? width : x0 + third;
    const rows = [];
    for (let y = 0; y < height; y++) {
      let ink = 0;
      for (let x = x0; x < x1; x += 2) if (isInk(x, y)) ink++;
      rows.push(ink > (x1 - x0) / 2 / 3);
    }
    const [top, bottom] = longestRun(rows);
    const cols = [];
    for (let x = x0; x < x1; x++) {
      let ink = 0;
      for (let y = top; y < bottom; y += 2) if (isInk(x, y)) ink++;
      cols.push(ink > (bottom - top) / 2 / 3);
    }
    const [left, right] = longestRun(cols);
    return { left: x0 + left, top, width: right - left, height: bottom - top };
  };
  const pred = measure(2);
  const gt = measure(1);
  const pitch = Math.abs(gt.width - pred.width) <= 4 ? pred.left - gt.left : third;
  return [0, 1, 2].map((col) => ({
    left: Math.max(0, pred.left - (2 - col) * pitch),
    top: pred.top,
    width: pred.width,
    height: pred.height,
  }));
}

async function syncGallery() {
  const figRoot = path.join(RESULTS, "figures");
  if (!existsSync(figRoot)) {
    console.warn("No results/figures — run scripts/make_figures.py first. Keeping existing gallery.");
    return null;
  }
  await rm(PUBLIC_GALLERY, { recursive: true, force: true });
  const items = [];
  const files = (await walk(figRoot)).filter((f) => f.endsWith(".png")).sort();
  for (const file of files) {
    const rel = path.relative(figRoot, file).split(path.sep);
    if (rel.length < 4) continue;
    const [section, dataset, category, fname] = rel;
    const name = path.basename(fname, ".png");
    const outDir = path.join(PUBLIC_GALLERY, section, dataset, category);
    await mkdir(outDir, { recursive: true });

    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const boxes = panelBoxes(data, info.width, info.height, info.channels);
    const entry = {
      id: `${section}/${dataset}/${category}/${name}`,
      section,
      dataset,
      category,
      name,
      full: `/gallery/${section}/${dataset}/${category}/${name}.webp`,
    };
    await sharp(file).webp({ quality: 82 }).toFile(path.join(outDir, `${name}.webp`));
    for (let i = 0; i < PANELS.length; i++) {
      const box = boxes[i];
      const out = path.join(outDir, `${name}-${PANELS[i]}.webp`);
      await sharp(file)
        .extract(box)
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(out);
      entry[PANELS[i]] = `/gallery/${section}/${dataset}/${category}/${name}-${PANELS[i]}.webp`;
      if (i === 0) entry.aspect = +(box.width / box.height).toFixed(4);
    }
    items.push(entry);
  }
  return items;
}

async function syncAblations() {
  const root = path.join(RESULTS, "ablations");
  if (!existsSync(root)) return null;
  const rows = [];
  for (const file of (await walk(root)).filter((f) => f.endsWith(".json"))) {
    try {
      const d = JSON.parse(await readFile(file, "utf8"));
      if (!d.metrics) continue;
      rows.push({
        ablation: d.ablation,
        variant: String(d.variant),
        dataset: d.dataset,
        category: d.category,
        k: d.k,
        image_auroc: d.metrics.image_auroc ?? null,
        pixel_auroc: d.metrics.pixel_auroc ?? null,
        pro: d.metrics.pro ?? null,
      });
    } catch {
      // skip unreadable shard
    }
  }
  return rows;
}

async function main() {
  await mkdir(CONTENT, { recursive: true });

  const resultsPath = path.join(RESULTS, "results.json");
  if (existsSync(resultsPath)) {
    const results = JSON.parse(await readFile(resultsPath, "utf8"));
    const tables = path.join(RESULTS, "tables.md");
    results.tables_md = existsSync(tables) ? await readFile(tables, "utf8") : null;
    await writeFile(path.join(CONTENT, "results.json"), JSON.stringify(results));
    console.log("results.json synced");
  }

  const rows = await syncAblations();
  if (rows) {
    await writeFile(path.join(CONTENT, "ablations.json"), JSON.stringify({ rows }));
    console.log(`ablations: ${rows.length} rows`);
  }

  const gallery = await syncGallery();
  if (gallery) {
    await writeFile(path.join(CONTENT, "gallery.json"), JSON.stringify({ items: gallery }, null, 1));
    console.log(`gallery: ${gallery.length} figures cropped`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
