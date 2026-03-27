const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { createRes } = require('./helpers/testUtils.cjs');
const { createGuestRsvpToken, createSessionToken, getPlannerModel } = require('../api/_lib/core');
const { handlePlannerRsvp, handlePlannerRsvpLink } = require('../api/planner');

describe('api/planner.js -> rsvp routes', function () {
  let originalMongooseConnect;

  before(function () {
    originalMongooseConnect = mongoose.connect;
    mongoose.connect = async () => ({});
    process.env.MONGODB_URI = 'mongodb://example.test/vivahgo';
    process.env.JWT_SECRET = 'planner-rsvp-test-secret';
    process.env.RSVP_TOKEN_SECRET = 'planner-rsvp-link-secret';
  });

  after(function () {
    mongoose.connect = originalMongooseConnect;
    delete process.env.MONGODB_URI;
    delete process.env.JWT_SECRET;
    delete process.env.RSVP_TOKEN_SECRET;
  });

  it('creates a signed RSVP link for an editor', async function () {
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;
    const authToken = createSessionToken({
      googleId: 'editor-1',
      email: 'editor@example.com',
      name: 'Editor',
    });

    Planner.findOne = async () => ({
      googleId: 'owner-1',
      toObject: () => ({
        googleId: 'owner-1',
        activePlanId: 'plan_1',
        wedding: {},
        marriages: [
          {
            id: 'plan_1',
            bride: 'Asha',
            groom: 'Rohan',
            websiteSlug: 'asha-rohan-1',
            collaborators: [
              { email: 'owner@example.com', role: 'owner' },
              { email: 'editor@example.com', role: 'editor' },
            ],
          },
        ],
        guests: [
          { id: 7, name: 'Rajesh Sharma', planId: 'plan_1', guestCount: 4, rsvp: 'pending' },
        ],
        events: [],
        expenses: [],
        vendors: [],
        tasks: [],
      }),
    });

    try {
      const req = {
        method: 'POST',
        headers: {
          authorization: `Bearer ${authToken}`,
          origin: 'https://www.vivahgo.com',
        },
        body: { planId: 'plan_1', guestId: 7, plannerOwnerId: 'owner-1' },
        query: {},
      };
      const res = createRes();

      await handlePlannerRsvpLink(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(typeof res.body.token, 'string');
      assert.match(res.body.rsvpUrl, /^https:\/\/www\.vivahgo\.com\/rsvp\//);
      assert.equal(res.body.guestName, 'Rajesh Sharma');
    } finally {
      Planner.findOne = originalFindOne;
    }
  });

  it('returns guest RSVP details for a valid token', async function () {
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;
    const token = createGuestRsvpToken({
      ownerId: 'owner-1',
      planId: 'plan_1',
      guestId: '7',
      version: 1,
    });

    Planner.findOne = async () => ({
      googleId: 'owner-1',
      toObject: () => ({
        googleId: 'owner-1',
        activePlanId: 'plan_1',
        wedding: {},
        marriages: [
          { id: 'plan_1', bride: 'Asha', groom: 'Rohan', date: '12 Dec 2026', venue: 'Jaipur', websiteSlug: 'asha-rohan-1' },
        ],
        guests: [
          { id: 7, name: 'Rajesh Sharma', planId: 'plan_1', guestCount: 4, attendingGuestCount: 0, groupMembers: ['Sunaina Sharma', 'Kabir Sharma'], rsvp: 'pending' },
        ],
        events: [{ id: 1, name: 'Haldi', planId: 'plan_1', isPublicWebsiteVisible: true }],
        expenses: [],
        vendors: [],
        tasks: [],
      }),
    });

    try {
      const req = { method: 'GET', headers: {}, query: { token } };
      const res = createRes();

      await handlePlannerRsvp(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.guest.name, 'Rajesh Sharma');
      assert.equal(res.body.guest.invitedGuestCount, 4);
      assert.deepEqual(res.body.guest.groupMembers, ['Sunaina Sharma', 'Kabir Sharma']);
      assert.equal(res.body.plan.id, 'plan_1');
      assert.equal(res.body.events.length, 1);
    } finally {
      Planner.findOne = originalFindOne;
    }
  });

  it('saves a yes RSVP with attending guest count', async function () {
    const Planner = getPlannerModel();
    const originalFindOne = Planner.findOne;
    const originalFindOneAndUpdate = Planner.findOneAndUpdate;
    const token = createGuestRsvpToken({
      ownerId: 'owner-1',
      planId: 'plan_1',
      guestId: '7',
      version: 1,
    });
    let updatedGuests = null;

    Planner.findOne = async () => ({
      _id: 'planner-doc-1',
      googleId: 'owner-1',
      toObject: () => ({
        googleId: 'owner-1',
        activePlanId: 'plan_1',
        wedding: {},
        marriages: [
          { id: 'plan_1', bride: 'Asha', groom: 'Rohan', websiteSlug: 'asha-rohan-1' },
        ],
        guests: [
          { id: 7, name: 'Rajesh Sharma', planId: 'plan_1', guestCount: 4, attendingGuestCount: 0, rsvp: 'pending' },
        ],
        events: [],
        expenses: [],
        vendors: [],
        tasks: [],
      }),
    });
    Planner.findOneAndUpdate = async (_query, update) => {
      updatedGuests = update.$set.guests;
      return { acknowledged: true };
    };

    try {
      const req = {
        method: 'POST',
        headers: {},
        query: {},
        body: { token, rsvp: 'yes', attendingGuestCount: 3, groupMembers: ['Sunaina Sharma', 'Kabir Sharma', 'Extra Person'] },
      };
      const res = createRes();

      await handlePlannerRsvp(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.guest.rsvp, 'yes');
      assert.equal(res.body.guest.attendingGuestCount, 3);
      assert.deepEqual(res.body.guest.groupMembers, ['Sunaina Sharma', 'Kabir Sharma']);
      assert.equal(updatedGuests[0].attendingGuestCount, 3);
      assert.deepEqual(updatedGuests[0].groupMembers, ['Sunaina Sharma', 'Kabir Sharma']);
      assert.equal(updatedGuests[0].rsvp, 'yes');
      assert.equal(updatedGuests[0].rsvpTokenVersion, 2);
    } finally {
      Planner.findOne = originalFindOne;
      Planner.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });
});
