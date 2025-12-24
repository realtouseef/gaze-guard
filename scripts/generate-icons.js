const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function readManifest(manifestPath) {
  const raw = await fs.promises.readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function extractIconTargets(manifest) {
  const targets = [];
  const addMap = (map) => {
    if (!map) return;
    Object.entries(map).forEach(([size, p]) => {
      const n = Number(size);
      if (!Number.isNaN(n) && p.endsWith('.png')) {
        targets.push({ size: n, outPath: p });
      }
    });
  };
  addMap(manifest.icons);
  if (manifest.action && manifest.action.default_icon) addMap(manifest.action.default_icon);
  return targets
    .sort((a, b) => a.size - b.size)
    .filter((v, i, arr) => i === arr.findIndex((x) => x.size === v.size && x.outPath === v.outPath));
}

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generatePngs(svgPath, targets) {
  const svg = await fs.promises.readFile(svgPath);
  for (const { size, outPath } of targets) {
    await ensureDirExists(outPath);
    const outAbs = path.resolve(outPath);
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outAbs);
    console.log(`Generated ${outPath} (${size}x${size})`);
  }
}

async function main() {
  const root = process.cwd();
  const manifestPath = path.join(root, 'manifest.json');
  const svgPath = path.join(root, 'icons', 'icon.svg');

  if (!fs.existsSync(svgPath)) throw new Error(`Missing SVG: ${svgPath}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);

  const manifest = await readManifest(manifestPath);
  const targets = extractIconTargets(manifest);
  if (targets.length === 0) throw new Error('No PNG targets found in manifest');

  await generatePngs(svgPath, targets);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

