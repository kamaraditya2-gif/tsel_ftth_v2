import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const tilePath = params.path.join('/')
    const filePath = path.join(process.cwd(), 'public', 'tiles', tilePath)
    
    const file = await readFile(filePath)
    
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    // If local tile not found, proxy-fetch from OpenStreetMap server-side.
    // Proxying (instead of redirecting) avoids client-side CORS/blank-tile issues
    // and lets us send the required User-Agent header that OSM expects.
    try {
      const tilePath = params.path.join('/')
      const isJpg = tilePath.endsWith('.jpg')
      const tileKey = tilePath.replace(/\.(png|jpg)$/, '')
      const maptilerUrl = `https://api.maptiler.com/tiles/satellite/${tileKey}.jpg?key=3XChKc8u4YXTUmjuoqaP`

      const upstreamRes = await fetch(maptilerUrl, {
        headers: {
          'User-Agent': 'MojoJojoMonitor/1.0 (dashboard map tiles)',
        },
      })

      if (!upstreamRes.ok) {
        return new NextResponse(null, { status: upstreamRes.status })
      }

      const arrayBuffer = await upstreamRes.arrayBuffer()

      return new NextResponse(Buffer.from(arrayBuffer), {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': '*',
        },
      })
    } catch {
      return new NextResponse(null, { status: 502 })
    }
  }
}
