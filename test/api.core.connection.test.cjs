const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const corePath = require.resolve('../api/_lib/core');

describe('api/_lib/core.js connection reuse', function () {
  let originalConnect;

  beforeEach(function () {
    originalConnect = mongoose.connect;
    delete require.cache[corePath];
    process.env.MONGODB_URI = 'mongodb://example.test/vivahgo';
  });

  afterEach(function () {
    mongoose.connect = originalConnect;
    delete process.env.MONGODB_URI;
    delete require.cache[corePath];
    require(corePath);
  });

  it('reuses the same connect promise across concurrent cold requests', async function () {
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    mongoose.connect = async () => {
      calls += 1;
      await gate;
      return { ok: true };
    };

    const { connectDb } = require(corePath);
    const promiseA = connectDb();
    const promiseB = connectDb();

    assert.equal(calls, 1);

    release();
    const [connectionA, connectionB] = await Promise.all([promiseA, promiseB]);
    assert.deepEqual(connectionA, { ok: true });
    assert.deepEqual(connectionB, { ok: true });
    assert.equal(calls, 1);
  });
});
