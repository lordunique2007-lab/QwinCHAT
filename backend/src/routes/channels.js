const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

function generateInviteLink() {
  return Math.random().toString(36).substring(2, 12);
}

// Create channel
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const inviteLink = generateInviteLink();
    const { rows } = await db.query(`
      INSERT INTO channels (name, description, type, invite_link, owner_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, description, type || 'public', inviteLink, req.user.id]);

    await db.query(
      'INSERT INTO channel_subscribers (channel_id, user_id) VALUES ($1, $2)',
      [rows[0].id, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Get user's channels
router.get('/my', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ch.*, cs.joined_at, ch.owner_id = $1 as is_owner
      FROM channels ch
      JOIN channel_subscribers cs ON cs.channel_id = ch.id AND cs.user_id = $1
      WHERE ch.is_deleted = false
      ORDER BY cs.joined_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Subscribe to channel
router.post('/:id/subscribe', auth, async (req, res) => {
  try {
    await db.query(
      'INSERT INTO channel_subscribers (channel_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.id]
    );
    await db.query(
      'UPDATE channels SET subscriber_count = (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = $1) WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Subscribed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe
router.post('/:id/unsubscribe', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM channel_subscribers WHERE channel_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    await db.query(
      'UPDATE channels SET subscriber_count = (SELECT COUNT(*) FROM channel_subscribers WHERE channel_id = $1) WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// Get channel messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await db.query(`
      SELECT m.*, u.username, u.display_name, u.avatar_url
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = $1 AND m.is_deleted_for_all = false
      ORDER BY m.created_at DESC LIMIT $2 OFFSET $3
    `, [req.params.id, limit, offset]);
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channel messages' });
  }
});

// Get channel analytics
router.get('/:id/analytics', auth, async (req, res) => {
  try {
    const channel = await db.query('SELECT * FROM channels WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
    if (!channel.rows[0]) return res.status(403).json({ error: 'Not channel owner' });

    const stats = await db.query(`
      SELECT
        COUNT(DISTINCT cs.user_id) as total_subscribers,
        COUNT(DISTINCT m.id) as total_posts,
        COUNT(DISTINCT mr.user_id) as total_reads
      FROM channels ch
      LEFT JOIN channel_subscribers cs ON cs.channel_id = ch.id
      LEFT JOIN messages m ON m.channel_id = ch.id
      LEFT JOIN message_reads mr ON mr.message_id = m.id
      WHERE ch.id = $1
    `, [req.params.id]);

    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
