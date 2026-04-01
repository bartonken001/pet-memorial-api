const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const auth = require('../middleware/auth');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create order (protected)
router.post('/', auth, async (req, res) => {
  try {
    const { product_id, quantity, total_price, shipping_address } = req.body;
    const user_id = req.user.userId;
    
    const result = await pool.query(
      `INSERT INTO orders (user_id, product_id, quantity, total_price, shipping_address, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [user_id, product_id, quantity, total_price, shipping_address]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Get user's orders (protected)
router.get('/', auth, async (req, res) => {
  try {
    const user_id = req.user.userId;
    
    const result = await pool.query(
      `SELECT o.*, p.name as product_name, p.image_url as product_image
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [user_id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get order by ID (protected)
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.userId;
    
    const result = await pool.query(
      `SELECT o.*, p.name as product_name, p.image_url as product_image
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [id, user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

module.exports = router;
