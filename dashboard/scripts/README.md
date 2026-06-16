# Download Indonesia Map Tiles for Offline Use

This script downloads OpenStreetMap tiles for the Indonesia region to your local server, enabling offline map functionality.

## Usage

1. **Navigate to the scripts directory:**
   ```bash
   cd dashboard/scripts
   ```

2. **Run the download script:**
   ```bash
   node download-indonesia-tiles.js
   ```

## What Gets Downloaded

The script downloads tiles for Indonesia at multiple zoom levels:

- **Zoom Level 5**: 25 tiles (Overview of entire Indonesia)
- **Zoom Level 6**: 81 tiles (Regional view)
- **Zoom Level 7**: 289 tiles (Province view)
- **Zoom Level 8**: 24 tiles for key cities (Jakarta, Surabaya, Medan, Makassar, Bali, Papua)

Total: ~419 tiles

## Where Tiles Are Stored

Tiles are saved to: `dashboard/public/tiles/{z}/{x}/{y}.png`

Example structure:
```
public/tiles/
├── 5/
│   ├── 24/
│   │   ├── 33.png
│   │   ├── 34.png
│   │   └── ...
│   └── ...
├── 6/
│   └── ...
├── 7/
│   └── ...
└── 8/
    └── ...
```

## How It Works

1. The script downloads tiles from OpenStreetMap servers
2. Tiles are saved locally in the `public/tiles` directory
3. The DeviceHeatmap component tries to load tiles from `/tiles/{z}/{x}/{y}.png` first
4. If local tiles are not found, it falls back to online OpenStreetMap tiles
5. This enables offline functionality when tiles are cached locally

## Important Notes

- **Rate Limiting**: The script includes a 100ms delay between downloads to avoid rate limiting
- **Resume Capability**: The script skips tiles that already exist, so you can resume interrupted downloads
- **Storage**: Approximately 5-10 MB of storage required for all tiles
- **License**: OpenStreetMap tiles are under ODbL license - ensure compliance with their terms of use

## Troubleshooting

If tiles don't load:
1. Check that the `public/tiles` directory exists
2. Verify the tile files are present
3. Check browser console for errors
4. Ensure the tiles are being served correctly by the web server

## Adding More Tiles

To add tiles for different regions or zoom levels, modify the `tileSets` array in `download-indonesia-tiles.js`:

```javascript
const tileSets = [
  { z: 5, xStart: 24, xEnd: 28, yStart: 33, yEnd: 38 },
  // Add more tile sets here
];
```
