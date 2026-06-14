const jwt = require('jsonwebtoken');
const db = require('../db');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1 AND is_banned = false AND is_frozen = false',
      [decoded.userId]
    );

    if (!rows[0]) return res.status(401).json({ error: 'User not found or suspended' });
    req.user = rows[0];
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const adminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

const superAdminAuth = async (req, res, next) => {
  await auth(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
  });
};

module.exports = { auth, adminAuth, superAdminAuth };
