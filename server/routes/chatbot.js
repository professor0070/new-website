const express = require('express');
const router = express.Router();
const db = require('../db');
const { optionalAuth } = require('../middleware/auth');

// ─── AvatarX Smart Knowledge Base ─────────────────────────────────
const KB = [
  {
    patterns: ['hello','hi','hey','howdy','hiya','sup','good morning','good evening'],
    response: (ctx) => `Hey${ctx.name ? ' ' + ctx.name : ''}! 👋 Welcome to **AvatarX Marketplace**. I'm your AI assistant. How can I help you today?`,
    chips: ['How does escrow work?', 'How do I buy?', 'How do I sell?']
  },
  {
    patterns: ['escrow','escrow work','escrow system','safe','secure'],
    response: () => `🔒 **AvatarX Escrow System**\n\nHere's how it works:\n1. **Buyer pays** → funds are held in escrow (not released to seller yet)\n2. **Seller delivers** the item/service\n3. **Buyer confirms** receipt → funds released to seller\n4. If there's a dispute, our team reviews and decides\n\nThis protects both buyers AND sellers! ✅`,
    chips: ['Is my money safe?', 'What if there\'s a dispute?', 'How do I confirm delivery?']
  },
  {
    patterns: ['dispute','problem','issue','complaint','refund','scam','cheat'],
    response: () => `⚖️ **Dispute Resolution**\n\nIf something goes wrong:\n1. Go to **Orders** page\n2. Click your order → **"Raise Dispute"**\n3. Describe the issue\n4. Our admin team will review within 24–48 hours\n\nDisputes can result in a full refund to buyer OR funds released to seller based on evidence.`,
    chips: ['How long does review take?', 'How does escrow work?', 'Contact support']
  },
  {
    patterns: ['buy','purchase','how to buy','buying','get','acquire'],
    response: () => `🛒 **How to Buy on AvatarX**\n\n1. Browse the **Marketplace**\n2. Click any listing you like\n3. Click **"Buy Now"** — funds are held in escrow\n4. Wait for seller to deliver\n5. Confirm receipt → seller gets paid!\n\nYou need wallet balance to purchase. Top up your wallet first! 💳`,
    chips: ['How do I top up wallet?', 'What if seller doesn\'t deliver?', 'How does escrow work?']
  },
  {
    patterns: ['sell','create listing','how to sell','selling','list item'],
    response: () => `💰 **How to Sell on AvatarX**\n\n1. Go to **Profile → Seller Dashboard**\n2. Click **"Create Listing"**\n3. Fill in details + upload a hero image\n4. Set your price and delivery method\n5. Hit **Publish** — go live instantly!\n\nOnce a buyer purchases, you'll deliver and get paid through escrow. ⚡`,
    chips: ['How do I get paid?', 'How does escrow work?', 'What can I sell?']
  },
  {
    patterns: ['wallet','balance','funds','money','top up','topup','deposit','withdraw','recharge'],
    response: () => `💳 **Wallet & Funds**\n\n- Your **AvatarX Wallet** holds INR balance\n- Use it to purchase any listing\n- When you sell, earnings appear here after escrow release\n- Go to the **Wallet** tab in the nav to see your balance\n\n**Demo users** start with ₹1,000 – ₹50,000 balance for testing! 🎉`,
    chips: ['How do I buy?', 'How do I sell?', 'Escrow system?']
  },
  {
    patterns: ['categories', 'what can i buy', 'types', 'items', 'goods', 'products'],
    response: () => `🎮 **Available Categories**\n\n💎 **Credits** — In-game currency packs\n👑 **VIP Access** — Premium membership passes\n💕 **Couples** — Couple bundles & animations\n🎨 **Skins** — Character skins & effects\n👗 **Outfits** — Clothing & accessories\n💃 **Animations** — Dance moves & emotes\n\nAll with instant or manual delivery options!`,
    chips: ['How to buy?', 'Best deals?', 'How does escrow work?']
  },
  {
    patterns: ['delivery', 'how long', 'instant', 'automatic', 'manual', 'when'],
    response: () => `⚡ **Delivery Methods**\n\n🔴 **Manual Delivery** — Seller delivers via in-game trade/gift. Usually within a few hours.\n\n🟢 **Automatic Delivery** — Instant! Seller pre-loads gift codes or uses API. You receive it right away.\n\nCheck the delivery badge on each listing before purchasing! ⏱️`,
    chips: ['How to buy?', 'Dispute policy?', 'What happens if seller is slow?']
  },
  {
    patterns: ['safe', 'trust', 'verified', 'legit', 'trustworthy', 'scam proof'],
    response: () => `🛡️ **Is AvatarX Safe?**\n\nYes! Here's why:\n✅ **Escrow protection** — money held until delivery confirmed\n✅ **Dispute system** — admin mediates all conflicts\n✅ **Seller ratings** — track record visible\n✅ **Secure transactions** — no direct payments to strangers\n\nWe've processed 500+ successful trades! 🔒`,
    chips: ['How does escrow work?', 'Dispute policy?', 'How to buy safely?']
  },
  {
    patterns: ['contact', 'support', 'help', 'admin', 'team', 'email'],
    response: () => `📧 **Contact Support**\n\nFor urgent issues:\n- 💬 Use the **dispute system** in your orders page\n- 📧 Email: **support@avatarx.com**\n- 🕐 Response time: typically within 24 hours\n\nFor general questions, I'm always here! Just ask me anything. 🤖`,
    chips: ['How do disputes work?', 'How does escrow work?', 'Back to start']
  },
  {
    patterns: ['stats', 'listings', 'how many', 'marketplace stats', 'numbers'],
    response: async () => {
      const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const listings = db.prepare("SELECT COUNT(*) as c FROM listings WHERE status = 'active'").get().c;
      const orders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
      return `📊 **Live Marketplace Stats**\n\n👥 **${users}** registered users\n🛒 **${listings}** active listings\n📦 **${orders}** total orders processed\n\nThe marketplace is growing! Join the community. 🚀`;
    },
    chips: ['How to buy?', 'How to sell?', 'How does escrow work?']
  },
  {
    patterns: ['otp', 'login', 'sign up', 'account', 'register', 'password', 'forgot'],
    response: () => `🔐 **Account & Login Help**\n\n- **Email + Password** — standard login\n- **Google Login** — one-click with your Google account\n- **OTP Login** — enter email → receive a one-time code (demo hint shown)\n\nForgot password? Use OTP login instead! It always works with your registered email. 💡`,
    chips: ['How to buy?', 'Wallet help?', 'Contact support']
  },
  {
    patterns: ['back to start', 'restart', 'menu', 'main menu', 'what can you do', 'help'],
    response: () => `🤖 **AvatarX Assistant — Main Menu**\n\nHere's what I can help you with:\n\n🛒 Buying & selling\n💳 Wallet & payments\n🔒 Escrow & safety\n⚖️ Disputes & refunds\n📊 Marketplace info\n🎮 Item categories\n📧 Contact support`,
    chips: ['How does escrow work?', 'How to buy?', 'How to sell?', 'Marketplace stats']
  }
];

// ─── POST /api/chatbot/message ─────────────────────────────────────
router.post('/message', optionalAuth, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const lower = message.toLowerCase().trim();
  const ctx = { name: req.user?.username || null };

  // Find best matching KB entry
  let matched = null;
  let bestScore = 0;

  for (const entry of KB) {
    const score = entry.patterns.reduce((acc, p) => {
      return lower.includes(p) ? acc + p.length : acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      matched = entry;
    }
  }

  let reply;
  let chips = [];

  if (matched && bestScore > 0) {
    reply = typeof matched.response === 'function'
      ? await matched.response(ctx)
      : matched.response;
    chips = matched.chips || [];
  } else {
    reply = `🤔 Hmm, I'm not sure about that. Here are some things I **can** help with:`;
    chips = ['How does escrow work?', 'How to buy?', 'How to sell?', 'Wallet help?', 'Contact support'];
  }

  res.json({ reply, chips, timestamp: new Date().toISOString() });
});

module.exports = router;
