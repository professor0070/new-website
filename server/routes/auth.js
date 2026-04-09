const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// ─── Signup ────────────────────────────────────────────────────────
router.post('/signup', (req, res) => {
  try {
    const { email, username, password } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, username, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existing) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)'
    ).run(email, username, passwordHash);

    // Create wallet
    db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(result.lastInsertRowid, 1000);

    // Generate token
    const user = db.prepare('SELECT id, email, username, avatar_url, role FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = jwt.sign({ id: user.id, email: user.email, username: user.username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// ─── Login ─────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ─── OTP Request (Mock) ───────────────────────────────────────────
router.post('/otp-request', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Mock OTP — in production, send real OTP via email/SMS
  console.log(`📧 Mock OTP for ${email}: 123456`);
  res.json({ message: 'OTP sent successfully', hint: 'Use 123456 for demo' });
});

// ─── OTP Verify (Mock) ────────────────────────────────────────────
router.post('/otp-verify', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  // Mock verification — always accept 123456
  if (otp !== '123456') {
    return res.status(401).json({ error: 'Invalid OTP' });
  }

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    // Auto-create account with OTP login
    const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 1000);
    const passwordHash = bcrypt.hashSync(Math.random().toString(36), 10);
    const result = db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').run(email, username, passwordHash);
    db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(result.lastInsertRowid, 1000);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar_url: user.avatar_url,
      bio: user.bio,
      role: user.role
    }
  });
});

// ─── Google OAuth Login (Mock Decoded) ────────────────────────────
router.post('/google', (req, res) => {
  const { token: googleToken } = req.body;
  if (!googleToken) return res.status(400).json({ error: 'Token is required' });

  // In production, we would verify this token via:
  // const { OAuth2Client } = require('google-auth-library');
  // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  // const ticket = await client.verifyIdToken({ idToken: googleToken, audience: ... });
  // const payload = ticket.getPayload();

  // MOCK PAYLOAD
  const payload = {
    email: 'googleuser@mockdomain.com',
    name: 'Google User',
    picture: '/assets/default-avatar.png'
  };

  try {
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email);

    if (!user) {
      // Auto-create account with Google 
      const username = payload.name.replace(/\s+/g, '') + Math.floor(Math.random() * 1000);
      const passwordHash = bcrypt.hashSync(Math.random().toString(36), 10); // Random unused password
      
      const transaction = db.transaction(() => {
        const result = db.prepare('INSERT INTO users (email, username, password_hash, avatar_url) VALUES (?, ?, ?, ?)').run(payload.email, username, passwordHash, payload.picture);
        db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(result.lastInsertRowid, 1000);
        return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
      });
      user = transaction();
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: 'Failed to authenticate via Google' });
  }
});

// ─── Get current user ──────────────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, email, username, avatar_url, bio, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

module.exports = router;
