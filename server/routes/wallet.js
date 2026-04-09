const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { processPayment } = require('../utils/payment');

// ─── Get Wallet ───────────────────────────────────────────────
router.get('/', authenticate, (req, res) => {
  const wallet = db.prepare("SELECT balance, escrow_balance FROM wallets WHERE user_id = ?").get(req.user.id);
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
  
  res.json({ wallet });
});

// ─── Get Transactions ─────────────────────────────────────────
router.get('/transactions', authenticate, (req, res) => {
  const transactions = db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json({ transactions });
});

// ─── Add Funds (Mock Payment) ─────────────────────────────────
router.post('/add', authenticate, (req, res) => {
  const { amount, method } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });

  // Simulate payment processing
  const paymentRecord = processPayment(amount, method, 'INR');

  const transaction = db.transaction(() => {
    // Add to balance
    db.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?").run(amount, req.user.id);
    
    // Log transaction
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description) 
      VALUES (?, 'deposit', ?, ?)
    `).run(req.user.id, amount, `Deposit via ${paymentRecord.provider} (${paymentRecord.transaction_id})`);
    
    return db.prepare("SELECT balance, escrow_balance FROM wallets WHERE user_id = ?").get(req.user.id);
  });

  try {
    const updatedWallet = transaction();
    res.json({ message: 'Funds added successfully', wallet: updatedWallet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

// ─── Withdraw Funds ───────────────────────────────────────────
router.post('/withdraw', authenticate, (req, res) => {
  const { amount, bankDetails } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
  if (!bankDetails) return res.status(400).json({ error: 'Bank details are required' });

  const wallet = db.prepare("SELECT balance FROM wallets WHERE user_id = ?").get(req.user.id);
  if (wallet.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  const transaction = db.transaction(() => {
    // Deduct from balance
    db.prepare("UPDATE wallets SET balance = balance - ? WHERE user_id = ?").run(amount, req.user.id);
    
    // Log transaction
    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, description) 
      VALUES (?, 'withdrawal', ?, ?)
    `).run(req.user.id, -amount, `Withdrawal to bank account: ${bankDetails}`);
    
    return db.prepare("SELECT balance, escrow_balance FROM wallets WHERE user_id = ?").get(req.user.id);
  });

  try {
    const updatedWallet = transaction();
    res.json({ message: 'Withdrawal initiated successfully', wallet: updatedWallet });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
});

module.exports = router;
