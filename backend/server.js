const createApp = require('./app');
const connectDB = require('./config/db');
const { loadConfig } = require('./config/env');

async function main() {
  const config = loadConfig();
  const app = createApp(config);

  await connectDB(config.mongoUri);
  console.log('MongoDB connected');

  const server = app.listen(config.port, () => console.log(`TaskMate API listening on port ${config.port} (${config.nodeEnv})`));

  // Let in-flight requests finish when the host stops the container.
  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
