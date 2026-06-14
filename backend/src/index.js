require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('combined'));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  message: { error: 'Too many requests. Please slow down.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts. Try again in 15 minutes.' }
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Maintenance mode check
app.use((req, res, next) => {
  if (global.maintenanceMode?.enabled && !req.path.includes('/admin')) {
    return res.status(503).json({
      error: 'maintenance',
      message: global.maintenanceMode.message || 'QwinCHAT is under maintenance. Back soon!'
    });
  }
  next();
});

// Registration check
app.use('/api/auth/register', (req, res, next) => {
  if (global.registrationsEnabled === false) {
    return res.status(403).json({ error: 'Registrations are currently disabled.' });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/stories', require('./routes/stories'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    app: 'QwinCHAT',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Init socket
const initSocket = require('./socket');
initSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════╗
║       QwinCHAT Backend v1.0       ║
║   Created by: Qwin Grace          ║
╠═══════════════════════════════════╣
║  Server:  http://localhost:${PORT}   ║
║  Mode:    ${process.env.NODE_ENV || 'development'}             ║
╚═══════════════════════════════════╝
  `);
});

module.exports = { app, server };
