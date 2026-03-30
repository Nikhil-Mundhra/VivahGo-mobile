const assert = require('node:assert/strict');

const {
  ensureFirebaseServerConfig,
  readFirebaseServerConfig,
} = require('../api/_lib/fcm');

describe('api/_lib/fcm.js', function () {
  const originalEnv = { ...process.env };

  afterEach(function () {
    process.env = { ...originalEnv };
  });

  it('reads Firebase server config from FIREBASE_SERVICE_ACCOUNT_JSON', function () {
    process.env = {
      ...originalEnv,
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({
        project_id: 'vivahgo-notifications',
        client_email: 'firebase-adminsdk@example.com',
        private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      }),
    };

    const config = readFirebaseServerConfig();

    assert.equal(config.projectId, 'vivahgo-notifications');
    assert.equal(config.clientEmail, 'firebase-adminsdk@example.com');
    assert.equal(config.privateKey, '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----');
  });

  it('rejects a non-PEM Firebase private key with a helpful error', function () {
    process.env = {
      ...originalEnv,
      FIREBASE_PROJECT_ID: 'vivahgo-notifications',
      FIREBASE_CLIENT_EMAIL: 'firebase-adminsdk@example.com',
      FIREBASE_PRIVATE_KEY: 'not-a-real-private-key',
    };

    assert.throws(
      () => ensureFirebaseServerConfig(),
      /Firebase server private key is invalid/
    );
  });
});
