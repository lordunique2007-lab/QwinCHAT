const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// Post a story
router.post('/create', auth, async (req, res) => {
  try {
    const { type, content, media_url, background_color, music_url } = req.body;
    const { rows } = await db.query(`
      INSERT INTO stories (user_id, type, content, media_url, background_color, music_url)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [req.user.id, type || 'text', content, media_url, background_color, music_url]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to post story' });
  }
});

// Get stories feed (contacts' stories)
router.get('/feed', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, u.username, u.display_name, u.avatar_url, u.is_verified,
        sv.viewed_at as viewed_at
      FROM stories s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN story_views sv ON sv.story_id = s.id AND sv.user_id = $1
      WHERE s.expires_at > NOW() AND (
        s.user_id = $1 OR
        s.user_id IN (SELECT contact_id FROM contacts WHERE user_id = $1 AND is_blocked = false)
      )
      ORDER BY sv.viewed_at NULLS FIRST, s.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// View a story
router.post('/:id/view', auth, async (req, res) => {
  try {
    await db.query(
      'INSERT INTO story_views (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.id, req.user.id]
    );
    await db.query(
      'UPDATE stories SET view_count = (SELECT COUNT(*) FROM story_views WHERE story_id = $1) WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Viewed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Get my stories with analytics
router.get('/mine', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.*, COUNT(sv.id) as view_count
      FROM stories s
      LEFT JOIN story_views sv ON sv.story_id = s.id
      WHERE s.user_id = $1 AND s.expires_at > NOW()
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Delete story
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM stories WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Story deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;
