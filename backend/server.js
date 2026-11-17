const http = require('http');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const app = require('./app');
const { initSocket } = require('./sockets');

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.port, () => {
    console.log(`[server] ReCircle AI API listening on :${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
