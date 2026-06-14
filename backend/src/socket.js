const jwt = require('jsonwebtoken');
const db = require('./db');

function initSocket(io) {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await db.query('SELECT * FROM users WHERE id = $1 AND is_banned = false', [decoded.userId]);
      if (!rows[0]) return next(new Error('User not found'));

      socket.user = rows[0];
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // Track online users
  const onlineUsers = new Map(); // userId -> Set of socketIds

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    console.log(`🔌 ${socket.user.username} connected (${socket.id})`);

    // Track online
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Update status
    await db.query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', ['online', userId]);
    socket.broadcast.emit('user:status', { user_id: userId, status: 'online' });

    // Join personal room
    socket.join(`user:${userId}`);

    // Join all user's groups
    const groups = await db.query('SELECT group_id FROM group_members WHERE user_id = $1', [userId]);
    groups.rows.forEach(g => socket.join(`group:${g.group_id}`));

    // Join all user's channels
    const channels = await db.query('SELECT channel_id FROM channel_subscribers WHERE user_id = $1', [userId]);
    channels.rows.forEach(c => socket.join(`channel:${c.channel_id}`));

    // === MESSAGING ===
    socket.on('message:send', async (data) => {
      try {
        const { conversation_id, group_id, channel_id, content, type, media_url, reply_to_id } = data;

        const { rows } = await db.query(`
          INSERT INTO messages (sender_id, conversation_id, group_id, channel_id, content, type, media_url, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `, [userId, conversation_id || null, group_id || null, channel_id || null,
            content, type || 'text', media_url || null, reply_to_id || null]);

        const msg = rows[0];

        // Add sender info
        const msgWithSender = {
          ...msg,
          username: socket.user.username,
          display_name: socket.user.display_name,
          avatar_url: socket.user.avatar_url,
          is_verified: socket.user.is_verified
        };

        if (conversation_id) {
          await db.query(
            'UPDATE conversations SET last_message_id = $1, last_message_at = NOW() WHERE id = $2',
            [msg.id, conversation_id]
          );
          // Get other participant
          const conv = await db.query(
            'SELECT participant_a, participant_b FROM conversations WHERE id = $1',
            [conversation_id]
          );
          const otherId = conv.rows[0].participant_a === userId
            ? conv.rows[0].participant_b
            : conv.rows[0].participant_a;

          io.to(`user:${otherId}`).emit('message:new', msgWithSender);
          socket.emit('message:sent', msgWithSender);
        }

        if (group_id) {
          io.to(`group:${group_id}`).emit('message:new', msgWithSender);
        }

        if (channel_id) {
          io.to(`channel:${channel_id}`).emit('message:new', msgWithSender);
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (data) => {
      const { conversation_id, group_id } = data;
      const payload = { user_id: userId, username: socket.user.username, display_name: socket.user.display_name };
      if (conversation_id) {
        socket.to(`conversation:${conversation_id}`).emit('typing:start', payload);
      }
      if (group_id) {
        socket.to(`group:${group_id}`).emit('typing:start', payload);
      }
    });

    socket.on('typing:stop', (data) => {
      const { conversation_id, group_id } = data;
      if (conversation_id) socket.to(`conversation:${conversation_id}`).emit('typing:stop', { user_id: userId });
      if (group_id) socket.to(`group:${group_id}`).emit('typing:stop', { user_id: userId });
    });

    // Join conversation room
    socket.on('conversation:join', (conversation_id) => {
      socket.join(`conversation:${conversation_id}`);
    });

    // Message read
    socket.on('message:read', async (data) => {
      try {
        const { message_id, conversation_id } = data;
        await db.query(
          'INSERT INTO message_reads (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [message_id, userId]
        );
        if (conversation_id) {
          socket.to(`conversation:${conversation_id}`).emit('message:read', { message_id, user_id: userId });
        }
      } catch (err) {}
    });

    // Message reaction
    socket.on('message:react', async (data) => {
      try {
        const { message_id, emoji } = data;
        const existing = await db.query(
          'SELECT id FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
          [message_id, userId, emoji]
        );
        if (existing.rows[0]) {
          await db.query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
        } else {
          await db.query(
            'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
            [message_id, userId, emoji]
          );
        }
        io.emit('message:reaction', { message_id, user_id: userId, emoji });
      } catch (err) {}
    });

    // === CALLS ===
    socket.on('call:initiate', async (data) => {
      const { callee_id, type } = data;
      const { rows } = await db.query(
        'INSERT INTO calls (caller_id, callee_id, type) VALUES ($1, $2, $3) RETURNING *',
        [userId, callee_id, type || 'voice']
      );
      io.to(`user:${callee_id}`).emit('call:incoming', {
        call_id: rows[0].id,
        caller: { id: userId, username: socket.user.username, display_name: socket.user.display_name, avatar_url: socket.user.avatar_url },
        type
      });
    });

    socket.on('call:accept', async (data) => {
      const { call_id, caller_id } = data;
      await db.query('UPDATE calls SET status = $1, started_at = NOW() WHERE id = $2', ['active', call_id]);
      io.to(`user:${caller_id}`).emit('call:accepted', { call_id });
    });

    socket.on('call:reject', async (data) => {
      const { call_id, caller_id } = data;
      await db.query('UPDATE calls SET status = $1 WHERE id = $2', ['rejected', call_id]);
      io.to(`user:${caller_id}`).emit('call:rejected', { call_id });
    });

    socket.on('call:end', async (data) => {
      const { call_id, other_user_id } = data;
      await db.query('UPDATE calls SET status = $1, ended_at = NOW() WHERE id = $2', ['ended', call_id]);
      io.to(`user:${other_user_id}`).emit('call:ended', { call_id });
    });

    // WebRTC signaling
    socket.on('webrtc:offer', (data) => {
      io.to(`user:${data.to}`).emit('webrtc:offer', { from: userId, offer: data.offer });
    });
    socket.on('webrtc:answer', (data) => {
      io.to(`user:${data.to}`).emit('webrtc:answer', { from: userId, answer: data.answer });
    });
    socket.on('webrtc:ice', (data) => {
      io.to(`user:${data.to}`).emit('webrtc:ice', { from: userId, candidate: data.candidate });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await db.query('UPDATE users SET status = $1, last_seen = NOW() WHERE id = $2', ['offline', userId]);
          socket.broadcast.emit('user:status', { user_id: userId, status: 'offline', last_seen: new Date() });
        }
      }
      console.log(`🔌 ${socket.user.username} disconnected`);
    });
  });
}

module.exports = initSocket;
