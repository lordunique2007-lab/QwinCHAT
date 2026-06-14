const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware/auth');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, display_name, email, phone, password, referral_code } = req.body;
    if (!username || !password || (!email && !phone)) {
      return res.status(400).json({ error: 'Username, password, and email or phone are required' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 OR phone = $3',
      [username, email || null, phone || null]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username, email, or phone already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const myReferralCode = generateReferralCode();

    let referrerId = null;
    if (referral_code) {
      const referrer = await db.query('SELECT id FROM users WHERE referral_code = $1', [referral_code]);
      if (referrer.rows[0]) {
        referrerId = referrer.rows[0].id;
      }
    }

    const { rows } = await db.query(`
      INSERT INTO users (username, display_name, email, phone, password_hash, referral_code, referred_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [username, display_name || username, email || null, phone || null, passwordHash, myReferralCode, referrerId]);

    const user = rows[0];

    if (referrerId) {
      await db.query('UPDATE users SET points = points + 1 WHERE id = $1', [referrerId]);
      await db.query('INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2)', [referrerId, user.id]);
    }

    const token = generateToken(user.id);
    delete user.password_hash;

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password required' });
    }

    const { rows } = await db.query(
      'SELECT * FROM users WHERE (email = $1 OR phone = $1 OR username = $1)',
      [identifier]
    );

    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.is_banned) return res.status(403).json({ error: `Account banned${user.ban_reason ? ': ' + user.ban_reason : ''}` });
    if (user.is_frozen) return res.status(403).json({ error: 'Account is frozen. Contact support.' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    await db.query('UPDATE users SET last_seen = NOW(), status = $1 WHERE id = $2', ['online', user.id]);

    const token = generateToken(user.id);
    delete user.password_hash;
    delete user.two_factor_secret;

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { contact, type } = req.body; // type: 'phone' or 'email'
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await db.query(
      'INSERT INTO otp_codes (contact, code, type, expires_at) VALUES ($1, $2, $3, $4)',
      [contact, code, type || 'phone', expiresAt]
    );

    // In production, send via Twilio or email
    // For now, return the code in dev mode
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'OTP sent', dev_code: code });
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { contact, code } = req.body;
    const { rows } = await db.query(
      'SELECT * FROM otp_codes WHERE contact = $1 AND code = $2 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [contact, code]
    );

    if (!rows[0]) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await db.query('UPDATE otp_codes SET used = true WHERE id = $1', [rows[0].id]);
    await db.query('UPDATE users SET is_verified = true WHERE email = $1 OR phone = $1', [contact]);

    res.json({ message: 'Verified successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  const user = { ...req.user };
  delete user.password_hash;
  delete user.two_factor_secret;
  res.json(user);
});

// Logout
router.post('/logout', auth, async (req, res) => {
  await db.query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', ['offline', req.user.id]);
  res.json({ message: 'Logged out' });
});

// Change password
router.put('/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password' });
  }
});

module.exports = router;
