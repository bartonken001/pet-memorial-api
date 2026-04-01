const http = require('http');
const { Pool } = require('pg');

console.log('Starting server...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize database tables
async function initDB() {
  console.log('Initializing database...');
  const client = await pool.connect();
  console.log('Connected to database');
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Users table created');

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Products table created');

    // Create orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1,
        total_price DECIMAL(10, 2) NOT NULL,
        shipping_address TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Orders table created');

    // Insert sample products
    const productCheck = await client.query('SELECT COUNT(*) FROM products');
    console.log('Current products count:', productCheck.rows[0].count);
    
    if (parseInt(productCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO products (name, description, price, category, image_url) VALUES
        ('定制宠物骨灰吊坠', '精美定制骨灰吊坠，可刻字', 299.00, 'pendant', 'https://example.com/pendant.jpg'),
        ('木质宠物骨灰盒', '高档木质骨灰盒，雕刻精细', 599.00, 'box', 'https://example.com/box.jpg'),
        ('宠物纪念树脂公仔', '1:1仿真树脂公仔，定制照片', 899.00, 'doll', 'https://example.com/doll.jpg')
      `);
      console.log('Sample products inserted');
    } else {
      console.log('Products already exist, skipping insert');
    }

    client.release();
    return true;
  } catch (error) {
    console.error('DB init error:', error);
    client.release();
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = req.url;
  console.log('Request:', req.method, url);

  // Health check
  if (url === '/api/health' || url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  // Products API
  if (url === '/api/products' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
      console.log('Products fetched:', result.rows.length);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result.rows));
    } catch (error) {
      console.error('Fetch products error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch products', details: error.message }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;

initDB().then((success) => {
  if (success) {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } else {
    console.error('Failed to initialize DB, exiting');
    process.exit(1);
  }
}).catch(err => {
  console.error('Init error:', err);
  process.exit(1);
});
