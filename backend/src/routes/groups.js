const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

function generateInviteLink() {
  return Math.random().toString(36).substring(2, 12);
}

// Create group
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const inviteLink = generateInviteLink();

    const { rows } = await db.query(`
      INSERT INTO groups (name, description, type, invite_link, owner_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [name, description, type || 'private', inviteLink, req.user.id]);

    const group = rows[0];
    await db.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
      [group.id, req.user.id, 'owner']
    );

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Get all groups for user
router.get('/my', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT g.*, gm.role, COUNT(gm2.id) as member_count,
        m.content as last_message, m.created_at as last_message_at
      FROM groups g
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
      LEFT JOIN group_members gm2 ON gm2.group_id = g.id
      LEFT JOIN messages m ON m.id = (SELECT id FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1)
      WHERE g.is_deleted = false
      GROUP BY g.id, gm.role, m.content, m.created_at
      ORDER BY m.created_at DESC NULLS LAST
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group details
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM groups WHERE id = $1 AND is_deleted = false', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Group not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Get group members
router.get('/:id/members', auth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.is_verified, u.is_premium,
             gm.role, gm.joined_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1
      ORDER BY CASE gm.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'moderator' THEN 3 ELSE 4 END
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Join group by invite link
router.post('/join/:invite_link', auth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM groups WHERE invite_link = $1 AND is_deleted = false', [req.params.invite_link]);
    if (!rows[0]) return res.status(404).json({ error: 'Invalid invite link' });

    const group = rows[0];
    const memberCount = await db.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [group.id]);

    if (parseInt(memberCount.rows[0].count) >= group.max_members) {
      return res.status(400).json({ error: 'Group is full. Owner needs to upgrade capacity.' });
    }

    await db.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [group.id, req.user.id]
    );
    res.json({ message: 'Joined group', group });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Leave group
router.post('/:id/leave', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Left group' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Update group (admin/owner)
router.put('/:id', auth, async (req, res) => {
  try {
    const member = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!member.rows[0] || !['admin', 'owner'].includes(member.rows[0].role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, description, type, rules, slow_mode_seconds, is_announcement_mode, avatar_url } = req.body;
    const { rows } = await db.query(`
      UPDATE groups SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        rules = COALESCE($4, rules),
        slow_mode_seconds = COALESCE($5, slow_mode_seconds),
        is_announcement_mode = COALESCE($6, is_announcement_mode),
        avatar_url = COALESCE($7, avatar_url),
        updated_at = NOW()
      WHERE id = $8 RETURNING *
    `, [name, description, type, rules, slow_mode_seconds, is_announcement_mode, avatar_url, req.params.id]);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Upgrade group capacity (costs 10 points)
router.post('/:id/upgrade', auth, async (req, res) => {
  try {
    const member = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!member.rows[0] || member.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only group owner can upgrade' });
    }

    const user = await db.query('SELECT points FROM users WHERE id = $1', [req.user.id]);
    if (user.rows[0].points < 10) {
      return res.status(400).json({ error: 'Insufficient points. Need 10 points per upgrade.' });
    }

    await db.query('UPDATE users SET points = points - 10 WHERE id = $1', [req.user.id]);
    const { rows } = await db.query(
      'UPDATE groups SET max_members = max_members + 50 WHERE id = $1 RETURNING max_members',
      [req.params.id]
    );
    res.json({ message: 'Group upgraded! +50 capacity', new_max: rows[0].max_members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upgrade group' });
  }
});

// Add/remove admin
router.put('/:id/members/:user_id/role', auth, async (req, res) => {
  try {
    const owner = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!owner.rows[0] || owner.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Only owner can change roles' });
    }

    const { role } = req.body;
    await db.query(
      'UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3',
      [role, req.params.id, req.params.user_id]
    );
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove member
router.delete('/:id/members/:user_id', auth, async (req, res) => {
  try {
    const admin = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!admin.rows[0] || !['admin', 'owner'].includes(admin.rows[0].role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [req.params.id, req.params.user_id]);
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
