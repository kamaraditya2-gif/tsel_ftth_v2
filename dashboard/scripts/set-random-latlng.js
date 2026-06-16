const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'mojojojo_database',
  user: process.env.DB_USER || 'mojojojo_user',
  password: process.env.DB_PASSWORD || 'mojojojo_password',
});

async function run() {
  const client = await pool.connect();
  try {
    const centerLat = -6.1750;
    const centerLng = 106.7417;
    const radiusDeg = 0.5; // ~ ±55 km around Jakarta

    const res = await client.query(
      `UPDATE devices_ont
       SET lat = $1 + (random() - 0.5) * $2,
           lng = $3 + (random() - 0.5) * $2
       WHERE lat IS NULL OR lng IS NULL
       RETURNING id, serial_number, lat, lng`,
      [centerLat, radiusDeg, centerLng]
    );

    console.log(`✅ Updated ${res.rowCount} devices with random lat/lng around Jakarta`);
    if (res.rows.length > 0) {
      console.log('Sample updates:');
      res.rows.slice(0, 5).forEach(r => {
        console.log(`  ID ${r.id} (${r.serial_number}): lat=${r.lat}, lng=${r.lng}`);
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
