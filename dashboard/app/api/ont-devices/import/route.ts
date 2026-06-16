import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import { Readable } from 'stream'

export async function POST(request: Request) {
  let client
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'Invalid CSV file' }, { status: 400 })
    }

    // Parse CSV with specific columns
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const devices = []
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length !== headers.length) {
        continue
      }

      const device: any = {}
      headers.forEach((header, index) => {
        device[header] = values[index]
      })

      // Map CSV columns to database columns
      const dbDevice = {
        device_name: device['cpe.cpeid'] || '',
        serial_number: device['cpe.cpeid'] || '',
        mac_address: device['cpe.macaddress'] || null,
        cpe_type: device['cpe.cpetype'] || null,
        manufacturer: device['cpe.manufacturer'] || null,
        model: device['cpe.model'] || null,
        ip_address: device['cpe.ip_address'] || null,
        group_id: device['cpe.regional_id'] || null,
        indihome_id: device['indihome_customers_info.indihome_id'] || null,
        status: device['cpe.state'] === '1' ? 'online' : 'offline',
        last_seen: device['cpe.lastMsg'] ? new Date(parseInt(device['cpe.lastMsg']) * 1000).toISOString() : null
      }

      if (dbDevice.serial_number) {
        devices.push(dbDevice)
      }
    }

    if (devices.length === 0) {
      return NextResponse.json({ error: 'No valid devices found in CSV', headers, sampleData: lines.slice(0, 3) }, { status: 400 })
    }

    client = await pool.connect()

    // Insert devices into database
    let count = 0
    let skipped = 0
    const errors: string[] = []
    for (const device of devices) {
      try {
        // Check if device already exists by serial_number
        const existing = await client.query(
          'SELECT id FROM devices_ont WHERE serial_number = $1',
          [device.serial_number]
        )

        if (existing.rows.length === 0) {
          await client.query(
            'INSERT INTO devices_ont (device_name, serial_number, mac_address, cpe_type, manufacturer, model, ip_address, group_id, indihome_id, status, last_seen, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())',
            [device.device_name, device.serial_number, device.mac_address, device.cpe_type, device.manufacturer, device.model, device.ip_address, device.group_id, device.indihome_id, device.status, device.last_seen]
          )
          count++
        } else {
          // Update existing device
          await client.query(
            'UPDATE devices_ont SET device_name = $1, mac_address = $2, cpe_type = $3, manufacturer = $4, model = $5, ip_address = $6, group_id = $7, indihome_id = $8, status = $9, last_seen = $10, updated_at = NOW() WHERE serial_number = $11',
            [device.device_name, device.mac_address, device.cpe_type, device.manufacturer, device.model, device.ip_address, device.group_id, device.indihome_id, device.status, device.last_seen, device.serial_number]
          )
          skipped++
        }
      } catch (error: any) {
        errors.push(`${device.serial_number}: ${error.message}`)
      }
    }

    return NextResponse.json({ 
      count, 
      skipped, 
      total: devices.length,
      errors: errors.slice(0, 10), // Return first 10 errors
      message: errors.length > 0
        ? `Imported ${count} new devices, updated ${skipped} existing devices. ${errors.length} errors occurred.`
        : `Successfully imported ${count} new devices and updated ${skipped} existing devices`
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to import devices' }, { status: 500 })
  } finally {
    if (client) client.release()
  }
}
