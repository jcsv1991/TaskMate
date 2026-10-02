const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  // Use an existing server when asked to (e.g. a service container in CI).
  if (process.env.MONGO_TEST_URI) return;
  const mongod = await MongoMemoryServer.create();
  globalThis.__MONGOD__ = mongod;
  process.env.MONGO_TEST_URI = mongod.getUri();
};
