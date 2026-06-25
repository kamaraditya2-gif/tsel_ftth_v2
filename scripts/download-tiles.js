/**
 * Download tiles Indonesia untuk offline mode
 * 
 * Usage: node scripts/download-tiles.js
 * 
 * Mendownload tiles dari server dan menyimpannya di public/tiles/
 * Sehingga map tetap jalan meski tanpa internet.
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'https://a.basemaps.cartocdn.com/dark_all'
const TILES_DIR = path.join(__dirname, '..', 'dashboard', 'public', 'tiles')
const MIN_ZOOM = 4
const MAX_ZOOM = 10  // 0-10 = ~200MB untuk Indonesia
const CONCURRENCY = 5
const TIMEOUT = 10000

// Bounding box Indonesia (longitude, latitude)
const INDONESIA_BBOX = {
  minLat: -11, maxLat: 6,
  minLng: 95, maxLng: 141
}

function tileXY(lat, lng, zoom) {
  const n = Math.pow(2, zoom)
  const x = Math.floor((lng + 180) / 360 * n)
  const latRad = lat * Math.PI / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

function shouldDownload(z, x, y) {
  const n = Math.pow(2, z)
  const lng = x / n * 360 - 180
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI

  return lat >= INDONESIA_BBOX.minLat && lat <= INDONESIA_BBOX.maxLat &&
         lng >= INDONESIA_BBOX.minLng && lng <= INDONESIA_BBOX.maxLng
}

function downloadTile(z, x, y) {
  return new Promise((resolve) => {
    const dir = path.join(TILES_DIR, String(z), String(x))
    const file = path.join(dir, `${y}.png`)

    if (fs.existsSync(file)) { resolve(false); return }

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    const url = `${BASE_URL}/${z}/${x}/${y}.png`
    const req = https.get(url, { timeout: TIMEOUT }, (res) => {
      if (res.statusCode !== 200) { resolve(false); return }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        fs.writeFileSync(file, Buffer.concat(chunks))
        resolve(true)
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

async function main() {
  console.log('Downloading tiles Indonesia (zoom 4-10)...')
  console.log(`Output: ${TILES_DIR}`)
  console.log('')

  let total = 0, success = 0
  const tiles = []

  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const topLeft = tileXY(INDONESIA_BBOX.maxLat, INDONESIA_BBOX.minLng, z)
    const bottomRight = tileXY(INDONESIA_BBOX.minLat, INDONESIA_BBOX.maxLng, z)

    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        if (shouldDownload(z, x, y)) {
          tiles.push({ z, x, y })
          total++
        }
      }
    }
  }

  console.log(`Total tiles to download: ${total}`)
  
  // Download with concurrency limit
  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    const batch = tiles.slice(i, i + CONCURRENCY)
    const results = await Promise.all(batch.map(t => downloadTile(t.z, t.x, t.y)))
    success += results.filter(Boolean).length
    const pct = ((i + batch.length) / total * 100).toFixed(1)
    process.stdout.write(`\rProgress: ${Math.min(i + batch.length, total)}/${total} (${pct}%) | Downloaded: ${success}`)
  }

  console.log('\n\nDone!')
  console.log(`Total tiles: ${total}, Downloaded: ${success}`)
  console.log(`Skipped (already exist): ${total - success}`)

  // Estimate size
  const size = getDirSize(TILES_DIR)
  console.log(`Total size: ${(size / 1024 / 1024).toFixed(1)} MB`)
}

function getDirSize(dir) {
  let size = 0
  try {
    const files = fs.readdirSync(dir, { recursive: true })
    for (const f of files) {
      try { size += fs.statSync(path.join(dir, f)).size } catch {}
    }
  } catch {}
  return size
}

main().catch(console.error)