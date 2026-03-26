const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const handler = require('../api/subscription');
const { createRes } = require('./helpers/testUtils.cjs');
const { getBillingReceiptModel, getUserModel } = require('../api/_lib/core');

function makeToken(payload = {}) {
  return jwt.sign(
    { sub: 'sub-123', email: 'paid@test.com', name: 'Paid User', ...payload },
    'change-me-before-production',
    { expiresIn: '7d' }
  );
}

describe('api/subscription.js', function () {
  let originalConnect;
  let User;
  let BillingReceipt;
  let originalUserFindOne;
  let originalUserUpdateOne;
  let originalReceiptCreate;
  let originalReceiptUpdateOne;
  let originalFetch;

  before(function () {
    originalConnect = mongoose.connect;
    mongoose.connect = async () => ({});
    process.env.MONGODB_URI = 'mongodb://example.test/vivahgo';
    process.env.SUBSCRIPTION_COUPONS_JSON = JSON.stringify([
      {
        code: 'VIVAHGO100',
        expiresAt: '2099-09-26T23:59:59.000Z',
        discountPercent: 100,
        applicablePlans: ['premium', 'studio'],
      },
    ]);
    User = getUserModel();
    BillingReceipt = getBillingReceiptModel();
    originalUserFindOne = User.findOne;
    originalUserUpdateOne = User.updateOne;
    originalReceiptCreate = BillingReceipt.create;
    originalReceiptUpdateOne = BillingReceipt.updateOne;
    originalFetch = global.fetch;
  });

  afterEach(function () {
    User.findOne = originalUserFindOne;
    User.updateOne = originalUserUpdateOne;
    BillingReceipt.create = originalReceiptCreate;
    BillingReceipt.updateOne = originalReceiptUpdateOne;
    global.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.BILLING_FROM_EMAIL;
  });

  after(function () {
    mongoose.connect = originalConnect;
    delete process.env.MONGODB_URI;
    delete process.env.SUBSCRIPTION_COUPONS_JSON;
  });

  it('returns a zero-amount quote for the 100% coupon', async function () {
    const req = {
      method: 'POST',
      query: { op: 'quote' },
      headers: { authorization: `Bearer ${makeToken()}` },
      body: { plan: 'premium', billingCycle: 'monthly', couponCode: 'VIVAHGO100' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.amount, 0);
    assert.equal(res.body.requiresPayment, false);
    assert.equal(res.body.appliedCoupon.code, 'VIVAHGO100');
  });

  it('bypasses Razorpay for a zero-amount confirmation and stores a receipt', async function () {
    User.findOne = () => ({ lean: async () => ({ googleId: 'sub-123', email: 'paid@test.com', name: 'Paid User' }) });
    let updatedUser = null;
    User.updateOne = async (_filter, update) => {
      updatedUser = update.$set;
      return { acknowledged: true };
    };

    let createdReceipt = null;
    BillingReceipt.create = async (payload) => {
      createdReceipt = { _id: 'receipt-1', ...payload };
      return createdReceipt;
    };
    BillingReceipt.updateOne = async () => ({ acknowledged: true });

    process.env.RESEND_API_KEY = 'resend-key';
    process.env.BILLING_FROM_EMAIL = 'billing@vivahgo.com';
    global.fetch = async () => ({ ok: true, json: async () => ({ id: 'email_123' }) });

    const req = {
      method: 'POST',
      query: { op: 'confirm' },
      headers: { authorization: `Bearer ${makeToken()}` },
      body: { plan: 'studio', billingCycle: 'yearly', couponCode: 'VIVAHGO100' },
    };
    const res = createRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.checkoutMode, 'internal_free');
    assert.equal(res.body.receipt.amount, 0);
    assert.equal(res.body.receipt.couponCode, 'VIVAHGO100');
    assert.equal(res.body.receipt.paymentProvider, 'internal');
    assert.equal(createdReceipt.plan, 'studio');
    assert.equal(updatedUser.subscriptionTier, 'studio');
  });
});
