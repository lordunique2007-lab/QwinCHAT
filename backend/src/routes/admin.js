const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, superAdminAuth } = require('../middleware/auth');

async function logAction(adminId, action, targetType, targetId, details, ip) {
  await db.query(
    'INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
    [adminId, action, targetType, targetId, details, ip]
  );
}

// === DASHBOARD STATS ===
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role != 'superadmin') as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours') as new_users_24h,
        (SELECT COUNT(*) FROM users WHERE is_banned = true) as banned_users,
        (SELECT COUNT(*) FROM users WHERE is_premium = true) as premium_users,
        (SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL '24 hours') as messages_24h,
        (SELECT COUNT(*) FROM groups WHERE is_deleted = false) as total_groups,
        (SELECT COUNT(*) FROM channels WHERE is_deleted = false) as total_channels,
        (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
        (SELECT COUNT(*) FROM users WHERE status = 'online') as online_now
    `);
    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// === USER MANAGEMENT ===
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50, q, filter } = req.query;
    const offset = (page - 1) * limit;
    let whereClause = "WHERE role != 'superadmin'";
    const params = [limit, offset];
    let paramIdx = 3;

    if (q) { whereClause += ` AND (username ILIKE $${paramIdx} OR email ILIKE $${paramIdx} OR display_name ILIKE $${paramIdx})`; params.push(`%${q}%`); paramIdx++; }
    if (filter === 'banned') whereClause += ' AND is_banned = true';
    if (filter === 'premium') whereClause += ' AND is_premium = true';
    if (filter === 'frozen') whereClause += ' AND is_frozen = true';

    const { rows } = await db.query(
      `SELECT id, username, display_name, email, phone, avatar_url, role, is_verified,
              is_premium, is_banned, is_frozen, is_shadow_banned, ban_reason, points,
              created_at, last_seen, status
       FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    const total = await db.query(`SELECT COUNT(*) FROM users ${whereClause}`, params.slice(2));
    res.json({ users: rows, total: parseInt(total.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Ban user
router.post('/users/:id/ban', adminAuth, async (req, res) => {
  try {
    const { reason, expires_at } = req.body;
    await db.query(
      'UPDATE users SET is_banned = true, ban_reason = $1, ban_expires_at = $2 WHERE id = $3',
      [reason, expires_at || null, req.params.id]
    );
    await logAction(req.user.id, 'ban_user', 'user', req.params.id, { reason, expires_at }, req.ip);
    res.json({ message: 'User banned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user
router.post('/users/:id/unban', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE users SET is_banned = false, ban_reason = null, ban_expires_at = null WHERE id = $1', [req.params.id]);
    await logAction(req.user.id, 'unban_user', 'user', req.params.id, {}, req.ip);
    res.json({ message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

// Freeze/Unfreeze
router.post('/users/:id/freeze', adminAuth, async (req, res) => {
  try {
    const { freeze } = req.body;
    await db.query('UPDATE users SET is_frozen = $1 WHERE id = $2', [freeze, req.params.id]);
    await logAction(req.user.id, freeze ? 'freeze_user' : 'unfreeze_user', 'user', req.params.id, {}, req.ip);
    res.json({ message: freeze ? 'Account frozen' : 'Account unfrozen' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update freeze status' });
  }
});

// Shadow ban
router.post('/users/:id/shadowban', adminAuth, async (req, res) => {
  try {
    const { shadow_ban } = req.body;
    await db.query('UPDATE users SET is_shadow_banned = $1 WHERE id = $2', [shadow_ban, req.params.id]);
    await logAction(req.user.id, 'shadow_ban_user', 'user', req.params.id, { shadow_ban }, req.ip);
    res.json({ message: shadow_ban ? 'Shadow banned' : 'Shadow ban removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update shadow ban' });
  }
});

// Delete account
router.delete('/users/:id', superAdminAuth, async (req, res) => {
  try {
    await logAction(req.user.id, 'delete_account', 'user', req.params.id, {}, req.ip);
    await db.query('DELETE FROM users WHERE id = $1 AND role != $2', [req.params.id, 'superadmin']);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Assign role
router.put('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can assign superadmin' });
    }
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]);
    await logAction(req.user.id, 'assign_role', 'user', req.params.id, { role }, req.ip);
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Adjust points
router.post('/users/:id/points', adminAuth, async (req, res) => {
  try {
    const { points, action } = req.body; // action: 'add' | 'remove' | 'set'
    let query;
    if (action === 'add') query = 'UPDATE users SET points = points + $1 WHERE id = $2';
    else if (action === 'remove') query = 'UPDATE users SET points = GREATEST(0, points - $1) WHERE id = $2';
    else query = 'UPDATE users SET points = $1 WHERE id = $2';
    await db.query(query, [points, req.params.id]);
    await logAction(req.user.id, 'adjust_points', 'user', req.params.id, { points, action }, req.ip);
    res.json({ message: 'Points updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update points' });
  }
});

// Toggle premium
router.post('/users/:id/premium', adminAuth, async (req, res) => {
  try {
    const { is_premium } = req.body;
    await db.query('UPDATE users SET is_premium = $1 WHERE id = $2', [is_premium, req.params.id]);
    await logAction(req.user.id, 'toggle_premium', 'user', req.params.id, { is_premium }, req.ip);
    res.json({ message: 'Premium status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update premium' });
  }
});

// Verify user badge
router.post('/users/:id/verify', adminAuth, async (req, res) => {
  try {
    const { is_verified } = req.body;
    await db.query('UPDATE users SET is_verified = $1 WHERE id = $2', [is_verified, req.params.id]);
    await logAction(req.user.id, 'toggle_verification', 'user', req.params.id, { is_verified }, req.ip);
    res.json({ message: 'Verification updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update verification' });
  }
});

// === BROADCAST ===
router.post('/broadcast', adminAuth, async (req, res) => {
  try {
    const { title, message, target } = req.body; // target: 'all'|'premium'|'groups'
    await logAction(req.user.id, 'broadcast', target, null, { title, message }, req.ip);
    // In production, this would send push notifications via FCM
    res.json({ message: `Broadcast sent to ${target}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to broadcast' });
  }
});

// === CONTENT MODERATION ===
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT r.*, 
        ru.username as reporter_username, ru.display_name as reporter_name,
        u.username as reported_username, u.display_name as reported_name
      FROM reports r
      JOIN users ru ON ru.id = r.reporter_id
      LEFT JOIN users u ON u.id = r.reported_user_id
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.put('/reports/:id', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE reports SET status = $1, resolved_by = $2 WHERE id = $3',
      [status, req.user.id, req.params.id]
    );
    res.json({ message: 'Report updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// Delete any message
router.delete('/messages/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE messages SET is_deleted_for_all = true, content = null WHERE id = $1', [req.params.id]);
    await logAction(req.user.id, 'delete_message', 'message', req.params.id, {}, req.ip);
    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete group
router.delete('/groups/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE groups SET is_deleted = true WHERE id = $1', [req.params.id]);
    await logAction(req.user.id, 'delete_group', 'group', req.params.id, {}, req.ip);
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Delete channel
router.delete('/channels/:id', adminAuth, async (req, res) => {
  try {
    await db.query('UPDATE channels SET is_deleted = true WHERE id = $1', [req.params.id]);
    await logAction(req.user.id, 'delete_channel', 'channel', req.params.id, {}, req.ip);
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// === AUDIT LOGS ===
router.get('/audit-logs', adminAuth, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT al.*, u.username as admin_username, u.display_name as admin_name
      FROM audit_logs al
      JOIN users u ON u.id = al.admin_id
      ORDER BY al.created_at DESC LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// === MAINTENANCE MODE ===
router.post('/maintenance', superAdminAuth, async (req, res) => {
  try {
    const { enabled, message } = req.body;
    // Store in Redis or env in production
    global.maintenanceMode = { enabled, message };
    await logAction(req.user.id, 'maintenance_mode', 'system', null, { enabled, message }, req.ip);
    res.json({ message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle maintenance mode' });
  }
});

// === TOGGLE REGISTRATIONS ===
router.post('/registrations', superAdminAuth, async (req, res) => {
  try {
    const { enabled } = req.body;
    global.registrationsEnabled = enabled;
    await logAction(req.user.id, 'toggle_registrations', 'system', null, { enabled }, req.ip);
    res.json({ message: `Registrations ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle registrations' });
  }
});

// === SEARCH (admin) ===
router.get('/search', adminAuth, async (req, res) => {
  try {
    const { q, type } = req.query;
    let results = {};

    if (!type || type === 'users') {
      const users = await db.query(
        `SELECT id, username, display_name, email, phone, role, is_banned FROM users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 10`,
        [`%${q}%`]
      );
      results.users = users.rows;
    }
    if (!type || type === 'groups') {
      const groups = await db.query(`SELECT id, name, type, max_members FROM groups WHERE name ILIKE $1 LIMIT 10`, [`%${q}%`]);
      results.groups = groups.rows;
    }
    if (!type || type === 'channels') {
      const channels = await db.query(`SELECT id, name, type, subscriber_count FROM channels WHERE name ILIKE $1 LIMIT 10`, [`%${q}%`]);
      results.channels = channels.rows;
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
