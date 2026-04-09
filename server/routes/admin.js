const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, adminOnly } = require('../middleware/auth');

// All routes require admin
router.use(authenticate, adminOnly);

// ─── Get All Disputes ─────────────────────────────────────────
router.get('/disputes', (req, res) => {
  const disputes = db.prepare(`
    SELECT d.*, o.amount, l.title as listing_title, u1.username as buyer_name, u2.username as seller_name
    FROM disputes d
    JOIN orders o ON d.order_id = o.id
    JOIN listings l ON o.listing_id = l.id
    JOIN users u1 ON o.buyer_id = u1.id
    JOIN users u2 ON o.seller_id = u2.id
    ORDER BY d.created_at DESC
  `).all();
  
  res.json({ disputes });
});

// ─── Resolve Dispute ──────────────────────────────────────────
router.post('/disputes/:id/resolve', (req, res) => {
  const { resolution, admin_notes } = req.body; // 'refund_buyer' or 'release_seller'
  if (!resolution || !['refund_buyer', 'release_seller'].includes(resolution)) {
    return res.status(400).json({ error: 'Invalid resolution action' });
  }

  const dispute = db.prepare("SELECT * FROM disputes WHERE id = ? AND status = 'open'").get(req.params.id);
  if (!dispute) return res.status(404).json({ error: 'Dispute not found or already resolved' });

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(dispute.order_id);

  const transaction = db.transaction(() => {
    if (resolution === 'refund_buyer') {
      // Refund buyer: deduct from seller's escrow, add to buyer's balance
      db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ? WHERE user_id = ?").run(order.amount, order.seller_id);
      db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?").run(order.amount, order.buyer_id);
      
      // Update order & dispute
      db.prepare("UPDATE orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
      db.prepare("UPDATE disputes SET status = 'resolved_buyer', admin_notes = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(admin_notes || '', dispute.id);
      
      // Logs
      db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)")
        .run(order.buyer_id, 'refund', order.amount, 'Dispute outcome: Refunded', order.id);
      db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)")
        .run(order.seller_id, 'escrow_release', -order.amount, 'Dispute outcome: Refunded back to buyer', order.id);
    } else {
      // Release to seller: deduct from escrow, add to seller's balance
      db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, balance = balance + ? WHERE user_id = ?").run(order.amount, order.amount, order.seller_id);
      
      // Update order & dispute
      db.prepare("UPDATE orders SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
      db.prepare("UPDATE disputes SET status = 'resolved_seller', admin_notes = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(admin_notes || '', dispute.id);
      
      // Logs
      db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)")
        .run(order.seller_id, 'escrow_release', order.amount, 'Dispute outcome: Funds released to you', order.id);
    }
  });

  try {
    transaction();
    res.json({ message: `Dispute resolved: ${resolution}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ─── Get System Stats ─────────────────────────────────────────
router.get('/stats', (req, res) => {
  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  const listingsCount = db.prepare("SELECT COUNT(*) as count FROM listings").get().count;
  const ordersCount = db.prepare("SELECT COUNT(*) as count FROM orders").get().count;
  const escrowTotal = db.prepare("SELECT SUM(escrow_balance) as total FROM wallets").get().total || 0;

  res.json({ usersCount, listingsCount, ordersCount, escrowTotal });
});

// ─── Broadcast Global Notification ──────────────────────────────
router.post('/notify', (req, res) => {
  const { title, message, type } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

  // user_id = null means it is a global broadcast seen by everyone
  db.prepare(`
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (NULL, ?, ?, ?)
  `).run(title, message, type || 'info');

  res.json({ success: true, message: 'Broadcast successful' });
});

module.exports = router;
