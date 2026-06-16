const bcrypt = require('bcrypt');

async function test() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Hash:', hash);
  
  const match = await bcrypt.compare('admin123', hash);
  console.log('Verify:', match);
}

test();
