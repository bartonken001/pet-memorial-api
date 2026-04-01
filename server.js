const http = require('http');
const { Pool } = require('pg');

console.log('Starting server...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'NOT SET');

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

// Initialize database tables
async function initDB() {
  console.log('Initializing database...');
  const client = await pool.connect();
  console.log('Connected to database');
  
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
    console.log('Users table ready');

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
    console.log('Products table ready');

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
    console.log('Orders table ready');

    // Check and insert sample products
    const productCheck = await client.query('SELECT COUNT(*) FROM products');
    console.log('Current products count:', productCheck.rows[0].count);
    
    if (parseInt(productCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO products (name, description, price, category, image_url) VALUES
        ('定制宠物骨灰吊坠', '精美定制骨灰吊坠，可刻字', 299.00, 'pendant', $1),
        ('木质宠物骨灰盒', '高档木质骨灰盒，雕刻精细', 599.00, 'box', $2),
        ('宠物纪念树脂公仔', '1:1仿真树脂公仔，定制照片', 899.00, 'doll', $3)
      `, [defaultImages.pendant, defaultImages.box, defaultImages.doll]);
      console.log('Sample products inserted with images');
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
      
      // Enhance products with default images if missing
      const products = result.rows.map(p => ({
        ...p,
        image_url: p.image_url || defaultImages[p.category] || 'https://via.placeholder.com/400x300?text=Product'
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(products));
    } catch (error) {
      console.error('Fetch products error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch products', details: error.message }));
    }
  }

  // Get single product
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

  // Register
  if (url === '/api/auth/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email, password, name } = JSON.parse(body);
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
          [email, hashedPassword, name]
        );
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows[0]));
      } catch (error) {
        console.error('Register error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Registration failed', details: error.message }));
      }
    });
    return;
  }

  // Login
  if (url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
        
        const user = result.rows[0];
        const validPass = await bcrypt.compare(password, user.password);
        if (!validPass) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid credentials' }));
        }
        
        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token, user: { id: user.id, email: user.email, name: user.name } }));
      } catch (error) {
        console.error('Login error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Login failed' }));
      }
    });
    return;
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
