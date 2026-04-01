const http = require('http');
const { Pool } = require('pg');

console.log('Starting server...');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Free product images
const defaultImages = {
  pendant: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400&h=300&fit=crop',
  box: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
  doll: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop'
};

async function initDB() {
  console.log('Initializing database...');
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Update existing products with new images
    await client.query('UPDATE products SET image_url = $1 WHERE category = $2', [defaultImages.pendant, 'pendant']);
    await client.query('UPDATE products SET image_url = $1 WHERE category = $2', [defaultImages.box, 'box']);
    await client.query('UPDATE products SET image_url = $1 WHERE category = $2', [defaultImages.doll, 'doll']);
    console.log('Product images updated');

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

  if (url === '/api/health' || url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  }

  // Init/Update product images
  if (url === '/api/init' || url === '/update-images') {
    const success = await initDB();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success, message: 'Images updated' }));
  }

  if (url === '/api/products' && req.method === 'GET') {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
      const products = result.rows.map(p => ({
        ...p,
        image_url: p.image_url || defaultImages[p.category] || 'https://via.placeholder.com/400x300?text=Product'
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(products));
    } catch (error) {
      console.error('Fetch products error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch products' }));
    }
  }

  if (url.match(/\/api\/products\/\d+/) && req.method === 'GET') {
    try {
      const id = url.split('/').pop();
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Product not found' }));
      }
      
      const product = {
        ...result.rows[0],
        image_url: result.rows[0].image_url || defaultImages[result.rows[0].category] || 'https://via.placeholder.com/400x300?text=Product'
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(product));
    } catch (error) {
      console.error('Fetch product error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch product' }));
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = process.env.PORT || 3000;

initDB().then((success) => {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Init error:', err);
  process.exit(1);
});
