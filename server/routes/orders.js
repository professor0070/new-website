const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { canTransition, getAutoConfirmTime, shouldAutoConfirm } = require('../utils/escrow');

// ─── Utility: Process Auto-Confirms ──────────────────────────────
function processAutoConfirms() {
  const pendingOrders = db.prepare("SELECT id, auto_confirm_at, seller_id, amount FROM orders WHERE status = 'delivered'").all();
  pendingOrders.forEach(order => {
    if (shouldAutoConfirm(order.auto_confirm_at)) {
      // Release funds
      const info = db.prepare("UPDATE orders SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
      if (info.changes > 0) {
        // Move funds from buyer's escrow to seller's balance
        // Wait, where is escrow held? usually on platform or buyer wallet. 
        // Let's assume escrow is held in seller's "escrow_balance" or buyer's "escrow_balance".
        // In our model: Buyer pays -> deducts from buyer 'balance', adds to buyer 'escrow_balance' or platform.
        // Actually, let's just deduct from buyer's balance immediately, and put into seller's 'escrow_balance'.
        db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, balance = balance + ? WHERE user_id = ?").run(order.amount, order.amount, order.seller_id);
        
        db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)").run(order.seller_id, 'escrow_release', order.amount, 'Funds released (Auto-confirm)', order.id);
        
        // Also release order state
        db.prepare("UPDATE orders SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
      }
    }
  });
}

// Middleware to run auto-confirms before any order action
router.use((req, res, next) => {
  processAutoConfirms();
  next();
});

// ─── Get my orders ───────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const asBuyer = db.prepare(`
    SELECT o.*, l.title, l.image_url, u.username as seller_name 
    FROM orders o 
    JOIN listings l ON o.listing_id = l.id 
    JOIN users u ON o.seller_id = u.id 
    WHERE o.buyer_id = ? ORDER BY o.created_at DESC
  `).all(req.user.id);
  
  const asSeller = db.prepare(`
    SELECT o.*, l.title, l.image_url, u.username as buyer_name 
    FROM orders o 
    JOIN listings l ON o.listing_id = l.id 
    JOIN users u ON o.buyer_id = u.id 
    WHERE o.seller_id = ? ORDER BY o.created_at DESC
  `).all(req.user.id);

  res.json({ asBuyer, asSeller });
});

// ─── Place Order (Escrow Funds) ──────────────────────────────────
router.post('/', authenticate, (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'Listing ID is required' });

  // Use transaction
  const transaction = db.transaction(() => {
    const listing = db.prepare("SELECT * FROM listings WHERE id = ?").get(listing_id);
    if (!listing) throw new Error('Listing not found');
    if (listing.status !== 'active') throw new Error('Listing is not active');
    if (listing.seller_id === req.user.id) throw new Error('Cannot buy your own listing');

    const buyerWallet = db.prepare("SELECT * FROM wallets WHERE user_id = ?").get(req.user.id);
    if (buyerWallet.balance < listing.price) throw new Error('Insufficient balance');

    // Deduct from buyer balance
    db.prepare("UPDATE wallets SET balance = balance - ? WHERE user_id = ?").run(listing.price, req.user.id);
    // Add to seller escrow
    db.prepare("UPDATE wallets SET escrow_balance = escrow_balance + ? WHERE user_id = ?").run(listing.price, listing.seller_id);

    // Create Order
    const orderInfo = db.prepare(`
      INSERT INTO orders (buyer_id, seller_id, listing_id, amount, status) 
      VALUES (?, ?, ?, ?, 'escrow_held')
    `).run(req.user.id, listing.seller_id, listing.id, listing.price);

    // Transactions log
    db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)").run(req.user.id, 'purchase', -listing.price, `Purchase ${listing.title} (Funds in escrow)`, orderInfo.lastInsertRowid);
    db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)").run(listing.seller_id, 'escrow_hold', listing.price, `Escrow hold for ${listing.title}`, orderInfo.lastInsertRowid);

    // Mark listing as sold if it's a one-off (for some categories we could leave active, but let's just mark sold)
    if (listing.category !== 'credits' && listing.category !== 'animations') {
      db.prepare("UPDATE listings SET status = 'sold' WHERE id = ?").run(listing.id);
    }
    
    return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderInfo.lastInsertRowid);
  });

  try {
    const order = transaction();
    res.status(201).json({ order, message: 'Order placed, funds held in escrow' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Deliver Order ───────────────────────────────────────────────
router.post('/:id/deliver', authenticate, (req, res) => {
  const { delivery_note } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.seller_id !== req.user.id) return res.status(403).json({ error: 'Not your order' });
  if (!canTransition(order.status, 'delivered')) return res.status(400).json({ error: `Cannot transition from ${order.status} to delivered` });

  const autoConfirmAt = getAutoConfirmTime();
  db.prepare(`
    UPDATE orders SET status = 'delivered', delivery_note = ?, updated_at = CURRENT_TIMESTAMP, auto_confirm_at = ? 
    WHERE id = ?
  `).run(delivery_note || '', autoConfirmAt, order.id);

  res.json({ message: 'Order marked as delivered. Waiting for buyer confirmation.' });
});

// ─── Confirm Order (Release Funds) ───────────────────────────────
router.post('/:id/confirm', authenticate, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.id) return res.status(403).json({ error: 'Not your order' });
  if (!canTransition(order.status, 'confirmed')) return res.status(400).json({ error: `Cannot confirm order in state ${order.status}` });

  const transaction = db.transaction(() => {
    // Release funds
    db.prepare("UPDATE wallets SET escrow_balance = escrow_balance - ?, balance = balance + ? WHERE user_id = ?").run(order.amount, order.amount, order.seller_id);
    db.prepare("INSERT INTO transactions (user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?)").run(order.seller_id, 'escrow_release', order.amount, 'Funds released (Buyer confirmed)', order.id);
    
    // Update state to released
    db.prepare("UPDATE orders SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
  });

  try {
    transaction();
    res.json({ message: 'Order confirmed and funds released to seller' });
  } catch (err) {
    res.status(500).json({ error: 'Error releasing funds' });
  }
});

// ─── Dispute Order ───────────────────────────────────────────────
router.post('/:id/dispute', authenticate, (req, res) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ error: 'Reason is required' });

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.user.id) return res.status(403).json({ error: 'Not your order' });
  if (!canTransition(order.status, 'disputed')) return res.status(400).json({ error: `Cannot dispute order in state ${order.status}` });

  const transaction = db.transaction(() => {
    db.prepare("UPDATE orders SET status = 'disputed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
    db.prepare("INSERT INTO disputes (order_id, raised_by, reason) VALUES (?, ?, ?)").run(order.id, req.user.id, reason);
  });

  try {
    transaction();
    res.json({ message: 'Dispute raised. Admin will intervene.' });
  } catch (err) {
    res.status(500).json({ error: 'Error raising dispute' });
  }
});

module.exports = router;
