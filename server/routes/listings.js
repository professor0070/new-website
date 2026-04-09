const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/assets/uploads/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'listing-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// ─── Get all listings ──────────────────────────────────────────────
router.get('/', optionalAuth, (req, res) => {
  const { category, search, minPrice, maxPrice, sort, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT l.*, u.username as seller_name, u.avatar_url as seller_avatar
    FROM listings l
    JOIN users u ON u.id = l.seller_id
    WHERE l.status = 'active'
  `;
  const params = [];

  if (category && category !== 'all') {
    query += ' AND l.category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (l.title LIKE ? OR l.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (minPrice) {
    query += ' AND l.price >= ?';
    params.push(Number(minPrice));
  }

  if (maxPrice) {
    query += ' AND l.price <= ?';
    params.push(Number(maxPrice));
  }

  // Sort
  switch (sort) {
    case 'price_asc': query += ' ORDER BY l.price ASC'; break;
    case 'price_desc': query += ' ORDER BY l.price DESC'; break;
    case 'oldest': query += ' ORDER BY l.created_at ASC'; break;
    default: query += ' ORDER BY l.created_at DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const listings = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM listings WHERE status = ?').get('active').count;

  res.json({ listings, total });
});

// ─── Get my listings (MUST be before /:id) ────────────────────────
router.get('/my/all', authenticate, (req, res) => {
  const listings = db.prepare(`
    SELECT * FROM listings WHERE seller_id = ? AND status != 'deleted' ORDER BY created_at DESC
  `).all(req.user.id);
  res.json({ listings });
});

// ─── Get single listing ───────────────────────────────────────────
router.get('/:id', optionalAuth, (req, res) => {
  const listing = db.prepare(`
    SELECT l.*, u.username as seller_name, u.avatar_url as seller_avatar, u.bio as seller_bio, u.created_at as seller_since
    FROM listings l
    JOIN users u ON u.id = l.seller_id
    WHERE l.id = ?
  `).get(req.params.id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  // Get seller stats
  const salesCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE seller_id = ? AND status IN (?, ?)').get(listing.seller_id, 'confirmed', 'released').count;
  listing.seller_sales = salesCount;

  res.json({ listing });
});

// ─── Create listing ────────────────────────────────────────────────
router.post('/', authenticate, upload.single('image'), (req, res) => {
  const { title, description, price, currency, category, delivery_method } = req.body;
  let image_url = req.body.image_url;
  
  if (req.file) {
    image_url = '/assets/uploads/' + req.file.filename;
  }

  if (!title || !description || !price || !category) {
    return res.status(400).json({ error: 'Title, description, price, and category are required' });
  }

  if (price <= 0) {
    return res.status(400).json({ error: 'Price must be greater than 0' });
  }

  const result = db.prepare(`
    INSERT INTO listings (seller_id, title, description, price, currency, category, delivery_method, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    title,
    description,
    price,
    currency || 'INR',
    category,
    delivery_method || 'manual',
    image_url || '/assets/default-listing.png'
  );

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ listing });
});

// ─── Update listing ───────────────────────────────────────────────
router.put('/:id', authenticate, upload.single('image'), (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your listing' });

  const { title, description, price, currency, category, delivery_method, status } = req.body;
  let image_url = req.body.image_url;
  if (req.file) {
    image_url = '/assets/uploads/' + req.file.filename;
  }
  
  const updates = [];
  const values = [];

  if (title) { updates.push('title = ?'); values.push(title); }
  if (description) { updates.push('description = ?'); values.push(description); }
  if (price) { updates.push('price = ?'); values.push(price); }
  if (currency) { updates.push('currency = ?'); values.push(currency); }
  if (category) { updates.push('category = ?'); values.push(category); }
  if (delivery_method) { updates.push('delivery_method = ?'); values.push(delivery_method); }
  if (image_url) { updates.push('image_url = ?'); values.push(image_url); }
  if (status) { updates.push('status = ?'); values.push(status); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.params.id);
  db.prepare(`UPDATE listings SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  res.json({ listing: updated });
});

// ─── Delete listing ────────────────────────────────────────────────
router.delete('/:id', authenticate, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not your listing' });
  }

  db.prepare("UPDATE listings SET status = 'deleted' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Listing deleted' });
});

module.exports = router;
