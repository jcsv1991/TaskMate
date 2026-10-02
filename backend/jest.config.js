/**
 * Two projects:
 *  - unit:        pure functions, no database
 *  - integration: full Express app (supertest) against a real MongoDB
 *
 * The database comes from mongodb-memory-server (downloads a mongod binary on
 * first run), or from MONGO_TEST_URI when you want to point at your own server.
 */
const common = { testEnvironment: 'node' };

module.exports = {
  testTimeout: 20000,
  collectCoverageFrom: ['app.js', 'config/**/*.js', 'middleware/**/*.js', 'models/**/*.js', 'routes/**/*.js', 'schemas/**/*.js', 'services/**/*.js', 'utils/**/*.js'],
  coverageThreshold: { global: { statements: 90, branches: 80, functions: 90, lines: 90 } },
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.js'] },
    {
      ...common,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/helpers/setupDb.js'],
    },
  ],
};
