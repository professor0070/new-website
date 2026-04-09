const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'avatarx.db');
const db = new DatabaseSync(dbPath);

db.transaction = function(fn) {
  return function(...args) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

// Enable WAL mode for better performance
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ─── Schema ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT DEFAULT '/assets/default-avatar.png',
    bio TEXT DEFAULT '',
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    balance REAL DEFAULT 0,
    escrow_balance REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'INR' CHECK(currency IN ('INR', 'CREDITS')),
    category TEXT NOT NULL CHECK(category IN ('credits', 'vip', 'couples', 'skins', 'outfits', 'animations', 'other')),
    delivery_method TEXT DEFAULT 'manual' CHECK(delivery_method IN ('manual', 'automatic')),
    image_url TEXT DEFAULT '/assets/default-listing.png',
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'paused', 'deleted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    listing_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'escrow_held', 'delivered', 'confirmed', 'disputed', 'refunded', 'released', 'cancelled')),
    delivery_note TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    auto_confirm_at DATETIME,
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES listings(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'purchase', 'sale', 'escrow_hold', 'escrow_release', 'refund')),
    amount REAL NOT NULL,
    description TEXT DEFAULT '',
    order_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    raised_by INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'under_review', 'resolved_buyer', 'resolved_seller')),
    admin_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (raised_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    type TEXT DEFAULT 'info',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
  CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
`);

// ─── Seed Data ─────────────────────────────────────────────────────
function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // Already seeded

  console.log('🌱 Seeding database with demo data...');

  // Create admin user
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (email, username, password_hash, avatar_url, bio, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('admin@avatarx.com', 'AvatarX_Admin', adminHash, '/assets/avatar-admin.png', 'Marketplace Administrator', 'admin');

  // Create demo sellers
  const sellerHash = bcrypt.hashSync('seller123', 10);
  const sellers = [
    ['maya@demo.com', 'MayaDesigns', sellerHash, '/assets/avatar-1.png', 'Premium avatar designer & VIP seller 🎨'],
    ['alex@demo.com', 'AlexTrader', sellerHash, '/assets/avatar-2.png', 'Top-rated credits dealer | 500+ sales ⭐'],
    ['zara@demo.com', 'ZaraCouples', sellerHash, '/assets/avatar-3.png', 'Couple package specialist 💕'],
    ['neon@demo.com', 'NeonSkins', sellerHash, '/assets/avatar-4.png', 'Exclusive skin creator | Limited editions 🔥'],
  ];

  sellers.forEach(s => {
    db.prepare(`INSERT INTO users (email, username, password_hash, avatar_url, bio) VALUES (?, ?, ?, ?, ?)`)
      .run(...s);
  });

  // Create wallets for all users
  const users = db.prepare('SELECT id FROM users').all();
  users.forEach(u => {
    const balance = u.id === 1 ? 100000 : Math.floor(Math.random() * 50000) + 5000;
    db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)').run(u.id, balance);
  });

  // Create demo listings
  const demoListings = [
    [2, 'Premium 10K Credits Pack', 'Get 10,000 in-game credits instantly delivered to your account. Trusted seller with 500+ successful trades.', 499, 'INR', 'credits', 'automatic', '/assets/listing-credits.png'],
    [2, '50K Credits Mega Bundle', 'Massive 50,000 credits bundle at discounted price. Best value pack available!', 1999, 'INR', 'credits', 'automatic', '/assets/listing-credits-mega.png'],
    [3, '30-Day VIP Gold Access', 'Unlock VIP Gold for 30 days. Includes exclusive rooms, badges, and priority support.', 799, 'INR', 'vip', 'manual', '/assets/listing-vip.png'],
    [3, 'Lifetime VIP Diamond', 'One-time purchase for permanent VIP Diamond status. Never expires!', 4999, 'INR', 'vip', 'manual', '/assets/listing-vip-diamond.png'],
    [4, 'Romantic Couple Bundle', 'Matching avatar outfits + couple pose animations + shared room decoration set.', 1299, 'INR', 'couples', 'manual', '/assets/listing-couple.png'],
    [4, 'Wedding Ceremony Pack', 'Complete wedding set: venue, outfits, rings, animations & guest invitations.', 2499, 'INR', 'couples', 'manual', '/assets/listing-wedding.png'],
    [5, 'Cyber Neon Skin Collection', 'Set of 5 exclusive cyberpunk-themed skins. Glow-in-the-dark effects included.', 699, 'INR', 'skins', 'automatic', '/assets/listing-skin.png'],
    [5, 'Dragon Warrior Outfit', 'Legendary dragon-themed outfit with particle effects and custom animations.', 999, 'INR', 'outfits', 'automatic', '/assets/listing-outfit.png'],
    [2, 'Dance Animation Pack (25)', 'Collection of 25 dance animations. Includes trending moves & classics.', 599, 'INR', 'animations', 'automatic', '/assets/listing-dance.png'],
    [5, 'Galaxy Wings + Aura Set', 'Stunning galaxy-themed wings with matching aura particles. Ultra rare!', 1599, 'INR', 'skins', 'manual', '/assets/listing-wings.png'],
  ];

  demoListings.forEach(l => {
    db.prepare(`INSERT INTO listings (seller_id, title, description, price, currency, category, delivery_method, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...l);
  });

  console.log('✅ Database seeded with demo data!');
}

seedDatabase();

module.exports = db;
