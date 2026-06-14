const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// Get or create conversation
router.post('/conversations', auth, async (req, res) => {
  try {
    const { other_user_id } = req.body;
    const [a, b] = [req.user.id, other_user_id].sort();

    let { rows } = await db.query(
      'SELECT * FROM conversations WHERE participant_a = $1 AND participant_b = $2',
      [a, b]
    );

    if (!rows[0]) {
      const result = await db.query(
        'INSERT INTO conversations (participant_a, participant_b) VALUES ($1, $2) RETURNING *',
        [a, b]
      );
      rows = result.rows;
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Get all conversations for user
router.get('/conversations', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT c.*,
        CASE WHEN c.participant_a = $1 THEN u2.id ELSE u1.id END as other_id,
        CASE WHEN c.participant_a = $1 THEN u2.username ELSE u1.username END as other_username,
        CASE WHEN c.participant_a = $1 THEN u2.display_name ELSE u1.display_name END as other_name,
        CASE WHEN c.participant_a = $1 THEN u2.avatar_url ELSE u1.avatar_url END as other_avatar,
        CASE WHEN c.participant_a = $1 THEN u2.status ELSE u1.status END as other_status,
        CASE WHEN c.participant_a = $1 THEN u2.is_verified ELSE u1.is_verified END as other_verified,
        m.content as last_message, m.type as last_message_type, m.created_at as last_message_at
      FROM conversations c
      JOIN users u1 ON u1.id = c.participant_a
      JOIN users u2 ON u2.id = c.participant_b
      LEFT JOIN messages m ON m.id = c.last_message_id
      WHERE c.participant_a = $1 OR c.participant_b = $1
      ORDER BY c.last_message_at DESC NULLS LAST
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages in conversation
router.get('/conversations/:conv_id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await db.query(`
      SELECT m.*, u.username, u.display_name, u.avatar_url, u.is_verified,
        rm.content as reply_content, rm.type as reply_type,
        ru.display_name as reply_sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN messages rm ON rm.id = m.reply_to_id
      LEFT JOIN users ru ON ru.id = rm.sender_id
      WHERE m.conversation_id = $1 AND m.is_deleted_for_all = false
        AND (m.scheduled_at IS NULL OR m.scheduled_at <= NOW())
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.params.conv_id, limit, offset]);

    // Mark messages as read
    await db.query(`
      INSERT INTO message_reads (message_id, user_id)
      SELECT m.id, $1 FROM messages m
      WHERE m.conversation_id = $2 AND m.sender_id != $1
      ON CONFLICT DO NOTHING
    `, [req.user.id, req.params.conv_id]);

    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message
router.post('/send', auth, async (req, res) => {
  try {
    const { conversation_id, group_id, channel_id, content, type, media_url, reply_to_id, scheduled_at } = req.body;

    const { rows } = await db.query(`
      INSERT INTO messages (sender_id, conversation_id, group_id, channel_id, content, type, media_url, reply_to_id, scheduled_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [req.user.id, conversation_id || null, group_id || null, channel_id || null,
        content, type || 'text', media_url || null, reply_to_id || null, scheduled_at || null]);

    const msg = rows[0];

    // Update conversation last message
    if (conversation_id) {
      await db.query(
        'UPDATE conversations SET last_message_id = $1, last_message_at = NOW() WHERE id = $2',
        [msg.id, conversation_id]
      );
    }

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Edit message
router.put('/:id/edit', auth, async (req, res) => {
  try {
    const { content } = req.body;
    const { rows } = await db.query(
      'UPDATE messages SET content = $1, is_edited = true, edited_at = NOW() WHERE id = $2 AND sender_id = $3 RETURNING *',
      [content, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Message not found or unauthorized' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
router.delete('/:id', auth, async (req, res) => {
  try {
    const { for_everyone } = req.query;
    if (for_everyone === 'true') {
      await db.query(
        'UPDATE messages SET is_deleted_for_all = true, content = null, media_url = null WHERE id = $1 AND sender_id = $2',
        [req.params.id, req.user.id]
      );
    }
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// React to message
router.post('/:id/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    const existing = await db.query(
      'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [req.params.id, req.user.id, emoji]
    );
    if (existing.rows[0]) {
      await db.query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
    } else {
      await db.query(
        'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
        [req.params.id, req.user.id, emoji]
      );
    }
    const { rows } = await db.query(
      'SELECT emoji, COUNT(*) as count FROM message_reactions WHERE message_id = $1 GROUP BY emoji',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to react' });
  }
});

// Pin/unpin message
router.put('/:id/pin', auth, async (req, res) => {
  try {
    const { is_pinned } = req.body;
    await db.query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [is_pinned, req.params.id]);
    res.json({ message: is_pinned ? 'Message pinned' : 'Message unpinned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pin' });
  }
});

// Star/unstar message
router.put('/:id/star', auth, async (req, res) => {
  try {
    const { is_starred } = req.body;
    await db.query('UPDATE messages SET is_starred = $1 WHERE id = $2 AND sender_id = $3', [is_starred, req.params.id, req.user.id]);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update star' });
  }
});

// Get group messages
router.get('/groups/:group_id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await db.query(`
      SELECT m.*, u.username, u.display_name, u.avatar_url, u.is_verified,
        rm.content as reply_content, ru.display_name as reply_sender_name
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN messages rm ON rm.id = m.reply_to_id
      LEFT JOIN users ru ON ru.id = rm.sender_id
      WHERE m.group_id = $1 AND m.is_deleted_for_all = false
      ORDER BY m.created_at DESC LIMIT $2 OFFSET $3
    `, [req.params.group_id, limit, offset]);
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

module.exports = router;
