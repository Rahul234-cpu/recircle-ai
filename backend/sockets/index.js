const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  // JWT handshake: client connects with io(url, { auth: { token } })
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findById(payload.sub).select('_id role isActive name');
      if (!user || !user.isActive) return next(new Error('unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { _id, role } = socket.user;
    socket.join(`user:${_id}`);
    socket.join(`role:${role}`);

    socket.on('typing', ({ to, conversationKey }) => {
      if (to) io.to(`user:${to}`).emit('typing', { from: String(_id), conversationKey });
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

function emitToRole(role, event, payload) {
  if (io) io.to(`role:${role}`).emit(event, payload);
}

module.exports = { initSocket, getIO, emitToUser, emitToRole };
