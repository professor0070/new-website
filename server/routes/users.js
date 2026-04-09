const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// ─── Get user profile ─────────────────────────────────────────────
router.get('/profile', authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.email, u.username, u.avatar_url, u.bio, u.role, u.created_at,
           w.balance, w.escrow_balance
    FROM users u
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // Get stats
  const listingCount = db.prepare('SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = ?').get(req.user.id, 'active').count;
  const salesCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE seller_id = ? AND status IN (?, ?)').get(req.user.id, 'confirmed', 'released').count;
  const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE buyer_id = ?').get(req.user.id).count;
  const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE seller_id = ? AND status IN (?, ?)').get(req.user.id, 'confirmed', 'released').total;
  const pendingEscrow = db.prepare('SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE seller_id = ? AND status = ?').get(req.user.id, 'escrow_held').total;

  // Weekly sales for chart (last 7 days)
  const weekly = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(amount),0) as revenue
    FROM orders
    WHERE seller_id = ? AND status IN ('confirmed','released')
      AND created_at >= date('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(req.user.id);

  res.json({
    user,
    stats: { listings: listingCount, sales: salesCount, purchases: purchaseCount, totalRevenue, pendingEscrow },
    weekly
  });
});

// ─── Update profile ───────────────────────────────────────────────
router.put('/profile', authenticate, (req, res) => {
  const { username, bio, avatar_url } = req.body;

  if (username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (existing) return res.status(409).json({ error: 'Username already taken' });
  }

  const updates = [];
  const values = [];

  if (username) { updates.push('username = ?'); values.push(username); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
  if (avatar_url) { updates.push('avatar_url = ?'); values.push(avatar_url); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT id, email, username, avatar_url, bio, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// ─── Get public profile by username ────────────────────────────────
router.get('/:username', (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.avatar_url, u.bio, u.created_at
    FROM users u WHERE u.username = ?
  `).get(req.params.username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const listingCount = db.prepare('SELECT COUNT(*) as count FROM listings WHERE seller_id = ? AND status = ?').get(user.id, 'active').count;
  const salesCount = db.prepare('SELECT COUNT(*) as count FROM orders WHERE seller_id = ? AND status IN (?, ?)').get(user.id, 'confirmed', 'released').count;

  res.json({
    user,
    stats: { listings: listingCount, sales: salesCount }
  });
});

module.exports = router;
