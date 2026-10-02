const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

/**
 * Connect to MongoDB. Throws on failure so the caller decides what to do (the
 * server exits, tests fail loudly) instead of the library calling process.exit.
 */
async function connectDB(uri) {
  if (!uri) throw new Error('MONGO_URI is not set. Copy backend/.env.example to backend/.env.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
