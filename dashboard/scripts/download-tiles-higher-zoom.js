// Download CartoDB dark tiles for high zoom levels
// Run: node scripts/download-tiles-higher-zoom.js
// Supplements existing tiles (zooms 4-10) with high-zoom tiles for offline use.

const fs = require('fs');
const path = require('path');
const https = require('https');

const tilesDir = path.join(__dirname, '../public/tiles');
if (!fs.existsSync(tilesDir)) {
  fs.mkdirSync(tilesDir, { recursive: true });
}

// NOP city centers - used for high zoom (13-18) tile coverage
const NOP_CITIES = [
  { name: 'Aceh', lat: 5.55, lng: 95.3167 },
  { name: 'Medan', lat: 3.5952, lng: 98.6722 },
  { name: 'Padang Sidempuan', lat: 1.1167, lng: 99.7333 },
  { name: 'Pematang Siantar', lat: 2.9667, lng: 99.0667 },
  { name: 'Rantau Prapat', lat: 2.1, lng: 99.8333 },
  { name: 'Batam', lat: 1.0833, lng: 104.0333 },
  { name: 'Bukittinggi', lat: -0.3, lng: 100.3667 },
  { name: 'Dumai', lat: 1.6833, lng: 101.45 },
  { name: 'Padang', lat: -0.95, lng: 100.35 },
  { name: 'Pekanbaru', lat: 0.5333, lng: 101.45 },
  { name: 'Bengkulu', lat: -3.8, lng: 102.2667 },
  { name: 'Jambi', lat: -1.6167, lng: 103.6167 },
  { name: 'Lampung', lat: -5.45, lng: 105.2667 },
  { name: 'Palembang', lat: -2.9833, lng: 104.75 },
  { name: 'Pangkal Pinang', lat: -2.1333, lng: 106.1167 },
  { name: 'Jakarta', lat: -6.175, lng: 106.8286 },
  { name: 'Serang', lat: -6.1167, lng: 106.15 },
  { name: 'Tangerang', lat: -6.179, lng: 106.63 },
  { name: 'Bekasi', lat: -6.2349, lng: 106.9896 },
  { name: 'Bogor', lat: -6.5972, lng: 106.806 },
  { name: 'Karawang', lat: -6.3333, lng: 107.3333 },
  { name: 'Bandung', lat: -6.9147, lng: 107.6098 },
  { name: 'Cirebon', lat: -6.715, lng: 108.555 },
  { name: 'Soreang', lat: -7.0167, lng: 107.5167 },
  { name: 'Tasikmalaya', lat: -7.3274, lng: 108.22 },
  { name: 'Magelang', lat: -7.4667, lng: 110.2167 },
  { name: 'Pekalongan', lat: -6.8917, lng: 109.6683 },
  { name: 'Purwokerto', lat: -7.4167, lng: 109.2333 },
  { name: 'Semarang', lat: -6.9667, lng: 110.4167 },
  { name: 'Surakarta', lat: -7.57, lng: 110.826 },
  { name: 'Yogyakarta', lat: -7.8, lng: 110.3667 },
  { name: 'Jember', lat: -8.1833, lng: 113.6833 },
  { name: 'Lamongan', lat: -6.8833, lng: 112.05 },
  { name: 'Madiun', lat: -7.63, lng: 111.53 },
  { name: 'Malang', lat: -7.9797, lng: 112.6304 },
  { name: 'Sidoarjo', lat: -7.4667, lng: 112.7167 },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7528 },
  { name: 'Denpasar', lat: -8.65, lng: 115.2167 },
  { name: 'Flores', lat: -8.35, lng: 121.0 },
  { name: 'Kupang', lat: -10.1667, lng: 123.5833 },
  { name: 'Mataram', lat: -8.5833, lng: 116.1167 },
  { name: 'Balikpapan', lat: -1.2667, lng: 116.8333 },
  { name: 'Banjarmasin', lat: -3.3167, lng: 114.5833 },
  { name: 'Palangkaraya', lat: -1.8833, lng: 113.5333 },
  { name: 'Pangkalan Bun', lat: -2.2167, lng: 113.9167 },
  { name: 'Pontianak', lat: -0.0333, lng: 109.3333 },
  { name: 'Samarinda', lat: -0.5, lng: 117.15 },
  { name: 'Tarakan', lat: 3.3167, lng: 117.6 },
  { name: 'Bone', lat: -4.5333, lng: 120.3333 },
  { name: 'Kendari', lat: -3.9667, lng: 122.5167 },
  { name: 'Makassar', lat: -5.1333, lng: 119.4167 },
  { name: 'Manado', lat: 1.4833, lng: 124.85 },
  { name: 'Palu', lat: -0.9, lng: 119.8667 },
  { name: 'Pare-pare', lat: -3.7167, lng: 119.6667 },
  { name: 'Ternate', lat: 0.8, lng: 127.3833 },
  { name: 'Ambon', lat: -3.7, lng: 128.1833 },
  { name: 'Jayapura', lat: -2.592, lng: 140.7014 },
  { name: 'Sorong', lat: -0.8667, lng: 131.25 },
  { name: 'Timika', lat: -4.5333, lng: 136.8833 },
];

// Broad region bounds for lower zooms
const REGION_BROAD = { minLat: -11, maxLat: 6.5, minLng: 94.5, maxLng: 141.5 };

// Java + Sumatra + Bali only (most populous ~85% of devices)
const REGION_CORE = { minLat: -9, maxLat: 6.5, minLng: 95, maxLng: 116 };

function lonToTileX(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

function latToTileY(lat, zoom) {
  return Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
}

function downloadTile(z, x, y) {
  return new Promise((resolve) => {
    const subdomains = ['a', 'b', 'c'];
    const subdomain = subdomains[Math.floor(Math.random() * subdomains.length)];
    const url = `https://${subdomain}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`;

    const zDir = path.join(tilesDir, z.toString());
    const xDir = path.join(zDir, x.toString());
    const filePath = path.join(xDir, `${y}.png`);

    if (!fs.existsSync(zDir)) fs.mkdirSync(zDir, { recursive: true });
    if (!fs.existsSync(xDir)) fs.mkdirSync(xDir, { recursive: true });

    if (fs.existsSync(filePath)) {
      resolve(false);
      return;
    }

    const file = fs.createWriteStream(filePath);

    https
      .get(url, { headers: { 'User-Agent': 'MojoJojoMonitor/1.0 (tile downloader)' } }, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve(true);
          });
        } else {
          fs.unlink(filePath, () => {});
          resolve(false);
        }
      })
      .on('error', () => {
        fs.unlink(filePath, () => {});
        resolve(false);
      });
  });
}

function getTilesForBounds(minLat, maxLat, minLng, maxLng, zoom) {
  const xMin = lonToTileX(minLng, zoom);
  const xMax = lonToTileX(maxLng, zoom);
  const yMin = latToTileY(maxLat, zoom);
  const yMax = latToTileY(minLat, zoom);
  const tiles = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

function getTilesAroundCity(lat, lng, zoom, span) {
  const cx = lonToTileX(lng, zoom);
  const cy = latToTileY(lat, zoom);
  const tiles = [];
  const max = Math.pow(2, zoom) - 1;
  for (let dx = -span; dx <= span; dx++) {
    for (let dy = -span; dy <= span; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x <= max && y >= 0 && y <= max) {
        tiles.push({ z: zoom, x, y });
      }
    }
  }
  return tiles;
}

async function downloadTiles(tiles, label) {
  const toDownload = tiles.filter((t) => {
    const fp = path.join(tilesDir, t.z.toString(), t.x.toString(), `${t.y}.png`);
    return !fs.existsSync(fp);
  });
  const skipped = tiles.length - toDownload.length;

  console.log(`  ${label}: ${toDownload.length} new, ${skipped} existing`);

  let count = 0;
  for (let i = 0; i < toDownload.length; i++) {
    const t = toDownload[i];
    const downloaded = await downloadTile(t.z, t.x, t.y);
    if (downloaded) count++;
    if ((i + 1) % 200 === 0) {
      console.log(`    ${i + 1}/${toDownload.length} (${count} new)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return count;
}

async function main() {
  console.log('=== Download CartoDB Dark Tiles for High Zoom Levels ===\n');

  let totalDownloaded = 0;

  // Zoom 11: full Indonesia (broad coverage)
  let tiles = getTilesForBounds(REGION_BROAD.minLat, REGION_BROAD.maxLat, REGION_BROAD.minLng, REGION_BROAD.maxLng, 11);
  console.log(`Zoom 11 (Indonesia): ${tiles.length} tiles`);
  let downloaded = await downloadTiles(tiles, 'Zoom 11');
  totalDownloaded += downloaded;

  // Zoom 12: full Indonesia
  tiles = getTilesForBounds(REGION_BROAD.minLat, REGION_BROAD.maxLat, REGION_BROAD.minLng, REGION_BROAD.maxLng, 12);
  console.log(`Zoom 12 (Indonesia): ${tiles.length} tiles`);
  downloaded = await downloadTiles(tiles, 'Zoom 12');
  totalDownloaded += downloaded;

  // Zoom 13: core regions only (Java + Sumatra + Bali)
  tiles = getTilesForBounds(REGION_CORE.minLat, REGION_CORE.maxLat, REGION_CORE.minLng, REGION_CORE.maxLng, 13);
  console.log(`Zoom 13 (Java+Sumatra): ${tiles.length} tiles`);
  downloaded = await downloadTiles(tiles, 'Zoom 13');
  totalDownloaded += downloaded;

  // Zoom 14: around NOP cities (span 5 tiles)
  let uniqueTiles = [];
  for (const city of NOP_CITIES) {
    uniqueTiles = uniqueTiles.concat(getTilesAroundCity(city.lat, city.lng, 14, 5));
  }
  const seen14 = new Set();
  uniqueTiles = uniqueTiles.filter(t => { const k = `${t.z}/${t.x}/${t.y}`; if (seen14.has(k)) return false; seen14.add(k); return true; });
  console.log(`Zoom 14 (NOP cities): ${uniqueTiles.length} tiles`);
  downloaded = await downloadTiles(uniqueTiles, 'Zoom 14');
  totalDownloaded += downloaded;

  // Zoom 15: around NOP cities (span 4 tiles)
  uniqueTiles = [];
  for (const city of NOP_CITIES) {
    uniqueTiles = uniqueTiles.concat(getTilesAroundCity(city.lat, city.lng, 15, 4));
  }
  const seen15 = new Set();
  uniqueTiles = uniqueTiles.filter(t => { const k = `${t.z}/${t.x}/${t.y}`; if (seen15.has(k)) return false; seen15.add(k); return true; });
  console.log(`Zoom 15 (NOP cities): ${uniqueTiles.length} tiles`);
  downloaded = await downloadTiles(uniqueTiles, 'Zoom 15');
  totalDownloaded += downloaded;

  // Zoom 16: around NOP cities (span 3 tiles)
  uniqueTiles = [];
  for (const city of NOP_CITIES) {
    uniqueTiles = uniqueTiles.concat(getTilesAroundCity(city.lat, city.lng, 16, 3));
  }
  const seen16 = new Set();
  uniqueTiles = uniqueTiles.filter(t => { const k = `${t.z}/${t.x}/${t.y}`; if (seen16.has(k)) return false; seen16.add(k); return true; });
  console.log(`Zoom 16 (NOP cities): ${uniqueTiles.length} tiles`);
  downloaded = await downloadTiles(uniqueTiles, 'Zoom 16');
  totalDownloaded += downloaded;

  // Zoom 17: around NOP cities (span 3 tiles) - NOP detail view
  uniqueTiles = [];
  for (const city of NOP_CITIES) {
    uniqueTiles = uniqueTiles.concat(getTilesAroundCity(city.lat, city.lng, 17, 3));
  }
  const seen17 = new Set();
  uniqueTiles = uniqueTiles.filter(t => { const k = `${t.z}/${t.x}/${t.y}`; if (seen17.has(k)) return false; seen17.add(k); return true; });
  console.log(`Zoom 17 (NOP cities): ${uniqueTiles.length} tiles`);
  downloaded = await downloadTiles(uniqueTiles, 'Zoom 17');
  totalDownloaded += downloaded;

  // Zoom 18: around NOP cities (span 3 tiles)
  uniqueTiles = [];
  for (const city of NOP_CITIES) {
    uniqueTiles = uniqueTiles.concat(getTilesAroundCity(city.lat, city.lng, 18, 3));
  }
  const seen18 = new Set();
  uniqueTiles = uniqueTiles.filter(t => { const k = `${t.z}/${t.x}/${t.y}`; if (seen18.has(k)) return false; seen18.add(k); return true; });
  console.log(`Zoom 18 (NOP cities): ${uniqueTiles.length} tiles`);
  downloaded = await downloadTiles(uniqueTiles, 'Zoom 18');
  totalDownloaded += downloaded;

  console.log(`\n=== Complete! Total new tiles downloaded: ${totalDownloaded} ===`);
  console.log(`Tiles saved to: ${tilesDir}`);
}

main().catch(console.error);
