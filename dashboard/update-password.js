const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'mojojojo_database',
  user: 'mojojojo_user',
  password: 'mojojojo_password',
});

async function updatePassword() {
  try {
    const hash = bcrypt.hashSync('admin123', 10);
    console.log('Generated hash:', hash);
    
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hash, 'admin']);
    console.log('Password updated successfully');
    
    const result = await pool.query('SELECT username, password FROM users WHERE username = $1', ['admin']);
    console.log('Updated user:', result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

updatePassword();
