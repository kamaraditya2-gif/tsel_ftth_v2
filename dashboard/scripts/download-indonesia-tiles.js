const fs = require('fs');
const path = require('path');
const https = require('https');

// Create tiles directory
const tilesDir = path.join(__dirname, '../public/tiles');
if (!fs.existsSync(tilesDir)) {
  fs.mkdirSync(tilesDir, { recursive: true });
}

// Indonesia tile coordinates at different zoom levels
const tileSets = [
  // Zoom level 5
  { z: 5, xStart: 24, xEnd: 28, yStart: 33, yEnd: 38 },
  // Zoom level 6
  { z: 6, xStart: 48, xEnd: 56, yStart: 66, yEnd: 76 },
  // Zoom level 7
  { z: 7, xStart: 96, xEnd: 112, yStart: 132, yEnd: 152 },
  // Zoom level 8 (key areas)
  { z: 8, xStart: 192, xEnd: 193, yStart: 268, yEnd: 269 }, // Jakarta
  { z: 8, xStart: 196, xEnd: 197, yStart: 272, yEnd: 273 }, // Surabaya
  { z: 8, xStart: 190, xEnd: 191, yStart: 264, yEnd: 265 }, // Medan
  { z: 8, xStart: 198, xEnd: 199, yStart: 274, yEnd: 275 }, // Makassar
  { z: 8, xStart: 204, xEnd: 205, yStart: 276, yEnd: 277 }, // Papua
];

function downloadTile(z, x, y) {
  return new Promise((resolve, reject) => {
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const zDir = path.join(tilesDir, z.toString());
    const xDir = path.join(zDir, x.toString());
    const filePath = path.join(xDir, `${y}.png`);

    // Create directories if they don't exist
    if (!fs.existsSync(zDir)) fs.mkdirSync(zDir, { recursive: true });
    if (!fs.existsSync(xDir)) fs.mkdirSync(xDir, { recursive: true });

    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`✓ Skipping: ${z}/${x}/${y}.png (already exists)`);
      resolve();
      return;
    }

    const file = fs.createWriteStream(filePath);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`✓ Downloaded: ${z}/${x}/${y}.png`);
          resolve();
        });
      } else {
        fs.unlink(filePath, () => {});
        console.log(`✗ Failed: ${z}/${x}/${y}.png (Status: ${response.statusCode})`);
        resolve();
      }
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      console.log(`✗ Error: ${z}/${x}/${y}.png (${err.message})`);
      resolve();
    });
  });
}

async function downloadAllTiles() {
  console.log('Starting download of Indonesia map tiles...\n');
  
  let totalTiles = 0;
  for (const tileSet of tileSets) {
    for (let x = tileSet.xStart; x <= tileSet.xEnd; x++) {
      for (let y = tileSet.yStart; y <= tileSet.yEnd; y++) {
        totalTiles++;
        await downloadTile(tileSet.z, x, y);
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }
  
  console.log(`\n✓ Download complete! Total tiles: ${totalTiles}`);
  console.log(`Tiles saved to: ${tilesDir}`);
}

downloadAllTiles().catch(console.error);
