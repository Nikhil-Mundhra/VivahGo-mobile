const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createRes } = require('./helpers/testUtils.cjs');

const corePath = require.resolve('../api/_lib/core');
const handlerPath = require.resolve('../api/vendor/media');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'vendor-123', email: 'vendor@test.com', name: 'Vendor Test', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

function attachMediaHelpers(items) {
  const media = items.map(item => ({ ...item }));

  media.id = function id(mediaId) {
    return media.find(item => String(item._id) === String(mediaId)) || null;
  };

  media.forEach(item => {
    item.deleteOne = () => {
      const index = media.findIndex(entry => String(entry._id) === String(item._id));
      if (index >= 0) {
        media.splice(index, 1);
      }
    };
  });

  return media;
}

function makeVendorDoc(items = []) {
  const media = attachMediaHelpers(items);
  return {
    media,
    async save() {
      return this;
    },
    toObject() {
      return {
        googleId: 'vendor-123',
        businessName: 'Vendor Test',
        media: media.map(item => {
          const clone = { ...item };
          delete clone.deleteOne;
          return clone;
        }),
      };
    },
  };
}

describe('api/vendor/media.js', function () {
  const originalCore = require(corePath);

  afterEach(function () {
    require.cache[corePath].exports = originalCore;
    delete require.cache[handlerPath];
  });

  it('creates a visible cover item on first upload', async function () {
    const vendorDoc = makeVendorDoc();

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        findOne: async () => vendorDoc,
      }),
    };

    const handler = require(handlerPath);
    const req = {
      method: 'POST',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        url: 'https://cdn.example.com/photo.jpg',
        type: 'IMAGE',
        filename: 'photo.jpg',
        size: 1024,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.vendor.media.length, 1);
    assert.equal(res.body.vendor.media[0].isCover, true);
    assert.equal(res.body.vendor.media[0].isVisible, true);
    assert.equal(res.body.vendor.media[0].sortOrder, 0);
  });

  it('updates metadata and cover state for an existing item', async function () {
    const vendorDoc = makeVendorDoc([
      { _id: 'm1', url: 'https://cdn.example.com/1.jpg', type: 'IMAGE', sortOrder: 0, filename: '1.jpg', size: 1, isCover: true, isVisible: true, caption: '', altText: '' },
      { _id: 'm2', url: 'https://cdn.example.com/2.jpg', type: 'IMAGE', sortOrder: 1, filename: '2.jpg', size: 1, isCover: false, isVisible: true, caption: '', altText: '' },
    ]);

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        findOne: async () => vendorDoc,
      }),
    };

    const handler = require(handlerPath);
    const req = {
      method: 'PUT',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        mediaId: 'm2',
        caption: 'Grand stage decor',
        altText: 'Red floral wedding stage',
        isVisible: false,
        makeCover: true,
      },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    const second = res.body.vendor.media.find(item => item._id === 'm2');
    const first = res.body.vendor.media.find(item => item._id === 'm1');
    assert.equal(second.caption, 'Grand stage decor');
    assert.equal(second.altText, 'Red floral wedding stage');
    assert.equal(second.isVisible, false);
    assert.equal(second.isCover, true);
    assert.equal(first.isCover, false);
  });

  it('reorders items and reassigns cover when the cover item is deleted', async function () {
    const vendorDoc = makeVendorDoc([
      { _id: 'm1', url: 'https://cdn.example.com/1.jpg', type: 'IMAGE', sortOrder: 0, filename: '1.jpg', size: 1, isCover: true, isVisible: true, caption: '', altText: '' },
      { _id: 'm2', url: 'https://cdn.example.com/2.jpg', type: 'IMAGE', sortOrder: 1, filename: '2.jpg', size: 1, isCover: false, isVisible: true, caption: '', altText: '' },
      { _id: 'm3', url: 'https://cdn.example.com/3.jpg', type: 'IMAGE', sortOrder: 2, filename: '3.jpg', size: 1, isCover: false, isVisible: true, caption: '', altText: '' },
    ]);

    require.cache[corePath].exports = {
      ...originalCore,
      connectDb: async () => {},
      getVendorModel: () => ({
        findOne: async () => vendorDoc,
      }),
    };

    const handler = require(handlerPath);
    const reorderReq = {
      method: 'PUT',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        mediaIds: ['m3', 'm1', 'm2'],
      },
    };
    const reorderRes = createRes();

    await handler(reorderReq, reorderRes);

    assert.equal(reorderRes.statusCode, 200);
    assert.deepEqual(reorderRes.body.vendor.media.map(item => item._id), ['m3', 'm1', 'm2']);

    const deleteReq = {
      method: 'DELETE',
      headers: { authorization: `Bearer ${makeToken()}` },
      body: {
        mediaId: 'm1',
      },
    };
    const deleteRes = createRes();

    await handler(deleteReq, deleteRes);

    assert.equal(deleteRes.statusCode, 200);
    assert.deepEqual(deleteRes.body.vendor.media.map(item => item._id), ['m3', 'm2']);
    assert.equal(deleteRes.body.vendor.media[0].isCover, true);
    assert.equal(deleteRes.body.vendor.media[0].sortOrder, 0);
    assert.equal(deleteRes.body.vendor.media[1].sortOrder, 1);
  });
});
