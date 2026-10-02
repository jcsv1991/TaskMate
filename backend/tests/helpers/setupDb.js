const mongoose = require('mongoose');
const crypto = require('crypto');

// Every test file gets its own database, so files can run in parallel and
// never see each other's data.
const dbName = `taskmate_test_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

beforeAll(async () => {
  const base = process.env.MONGO_TEST_URI.replace(/\/+$/, '').split('?')[0];
  await mongoose.connect(`${base}/${dbName}`);
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
