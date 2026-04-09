const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// ─── Get My Notifications ───────────────────────────────────────────
router.get('/my', authenticate, (req, res) => {
  // Fetch global notifications (user_id IS NULL) and direct user notifications
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id IS NULL OR user_id = ?
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);
  
  res.json({ notifications });
});

// ─── Mark as Read ──────────────────────────────────────────────────
router.post('/read/:id', authenticate, (req, res) => {
  // SQLite doesn't natively have array columns without JSON1 extension complex queries. 
  // For global notifications (user_id IS NULL), marking as read per user requires a mapping table.
  // To keep the DB simple, we'll assume this just marks targeted notifications.
  db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, req.user.id);

  res.json({ success: true });
});

module.exports = router;
