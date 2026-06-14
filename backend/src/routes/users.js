const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// Get user profile
router.get('/:username', auth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, display_name, bio, avatar_url, status, custom_status,
              is_verified, is_premium, role, last_seen, theme, accent_color,
              privacy_last_seen, privacy_profile_photo, created_at
       FROM users WHERE username = $1 AND is_banned = false`,
      [req.params.username]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update profile
router.put('/profile/update', auth, async (req, res) => {
  try {
    const { display_name, bio, status, custom_status, username, accent_color, theme } = req.body;

    if (username && username !== req.user.username) {
      const exists = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      if (exists.rows.length > 0) return res.status(400).json({ error: 'Username taken' });
    }

    const { rows } = await db.query(`
      UPDATE users SET
        display_name = COALESCE($1, display_name),
        bio = COALESCE($2, bio),
        status = COALESCE($3, status),
        custom_status = COALESCE($4, custom_status),
        username = COALESCE($5, username),
        accent_color = COALESCE($6, accent_color),
        theme = COALESCE($7, theme),
        updated_at = NOW()
      WHERE id = $8 RETURNING *
    `, [display_name, bio, status, custom_status, username, accent_color, theme, req.user.id]);

    delete rows[0].password_hash;
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update avatar
router.put('/profile/avatar', auth, async (req, res) => {
  try {
    const { avatar_url } = req.body;
    await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatar_url, req.user.id]);
    res.json({ avatar_url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Search users
router.get('/search/query', auth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    const { rows } = await db.query(
      `SELECT id, username, display_name, avatar_url, bio, is_verified, is_premium, status
       FROM users WHERE (username ILIKE $1 OR display_name ILIKE $1) AND is_banned = false AND id != $2 LIMIT 20`,
      [`%${q}%`, req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get contacts
router.get('/contacts/list', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.last_seen,
             u.is_verified, u.is_premium, c.is_blocked, c.nickname
      FROM contacts c
      JOIN users u ON u.id = c.contact_id
      WHERE c.user_id = $1
      ORDER BY u.display_name
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add contact
router.post('/contacts/add', auth, async (req, res) => {
  try {
    const { contact_id } = req.body;
    await db.query(
      'INSERT INTO contacts (user_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, contact_id]
    );
    res.json({ message: 'Contact added' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// Block/unblock
router.put('/contacts/:contact_id/block', auth, async (req, res) => {
  try {
    const { is_blocked } = req.body;
    await db.query(
      'UPDATE contacts SET is_blocked = $1 WHERE user_id = $2 AND contact_id = $3',
      [is_blocked, req.user.id, req.params.contact_id]
    );
    res.json({ message: is_blocked ? 'User blocked' : 'User unblocked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

// Get points & rewards
router.get('/rewards/info', auth, async (req, res) => {
  try {
    const user = await db.query('SELECT points, referral_code FROM users WHERE id = $1', [req.user.id]);
    const today = new Date().toDateString();
    const lastReward = await db.query(
      'SELECT claimed_at FROM daily_rewards WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
      [req.user.id]
    );
    const canClaimDaily = !lastReward.rows[0] || new Date(lastReward.rows[0].claimed_at).toDateString() !== today;

    res.json({ ...user.rows[0], can_claim_daily: canClaimDaily });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});

// Claim daily reward
router.post('/rewards/daily', auth, async (req, res) => {
  try {
    const today = new Date().toDateString();
    const lastReward = await db.query(
      'SELECT claimed_at FROM daily_rewards WHERE user_id = $1 ORDER BY claimed_at DESC LIMIT 1',
      [req.user.id]
    );
    if (lastReward.rows[0] && new Date(lastReward.rows[0].claimed_at).toDateString() === today) {
      return res.status(400).json({ error: 'Daily reward already claimed' });
    }

    await db.query('UPDATE users SET points = points + 2 WHERE id = $1', [req.user.id]);
    await db.query('INSERT INTO daily_rewards (user_id) VALUES ($1)', [req.user.id]);
    res.json({ message: '+2 points claimed!', points_added: 2 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

// Update privacy settings
router.put('/privacy/settings', auth, async (req, res) => {
  try {
    const { privacy_last_seen, privacy_profile_photo, privacy_about, privacy_groups } = req.body;
    await db.query(`
      UPDATE users SET
        privacy_last_seen = COALESCE($1, privacy_last_seen),
        privacy_profile_photo = COALESCE($2, privacy_profile_photo),
        privacy_about = COALESCE($3, privacy_about),
        privacy_groups = COALESCE($4, privacy_groups)
      WHERE id = $5
    `, [privacy_last_seen, privacy_profile_photo, privacy_about, privacy_groups, req.user.id]);
    res.json({ message: 'Privacy settings updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update privacy' });
  }
});

module.exports = router;
