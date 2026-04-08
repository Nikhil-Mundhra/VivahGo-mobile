const mongoose = require('mongoose');

const {
  connectDb,
  getChoiceProfileModel,
  getPlannerModel,
} = require('../api/_lib/core');
const {
  DEFAULT_VCA_TYPES,
  buildChoiceProfileId,
  buildDefaultChoiceProfileSeed,
  inferChoiceProfileSeedOverrides,
} = require('../api/_lib/vca');

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeChoiceTextField(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChoiceServices(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(
    value
      .filter(item => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  )).slice(0, 80);
}

function normalizeChoiceCoverageAreas(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      country: typeof item.country === 'string' ? item.country.trim() : '',
      state: typeof item.state === 'string' ? item.state.trim() : '',
      city: typeof item.city === 'string' ? item.city.trim() : '',
    }))
    .filter(item => item.country || item.state || item.city);
}

function normalizeChoiceBudgetRange(value, fallback = null) {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const min = Number(value.min);
  const max = Number(value.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
    return fallback;
  }

  return {
    min: Math.round(Math.min(min, max)),
    max: Math.round(Math.max(min, max)),
  };
}

function buildMigratedChoiceProfileDocument(seedProfile, sourceProfile) {
  const inferredOverrides = inferChoiceProfileSeedOverrides(seedProfile, sourceProfile);
  const existingServices = normalizeChoiceServices(sourceProfile?.services);
  const existingBundledServices = normalizeChoiceServices(sourceProfile?.bundledServices);
  const existingCoverageAreas = normalizeChoiceCoverageAreas(sourceProfile?.coverageAreas);

  return {
    _id: seedProfile._id,
    type: seedProfile.type,
    businessName: hasNonEmptyString(sourceProfile?.businessName)
      ? sourceProfile.businessName.trim()
      : hasNonEmptyString(sourceProfile?.name)
        ? sourceProfile.name.trim()
        : seedProfile.businessName,
    name: hasNonEmptyString(sourceProfile?.name)
      ? sourceProfile.name.trim()
      : hasNonEmptyString(sourceProfile?.businessName)
        ? sourceProfile.businessName.trim()
        : seedProfile.name,
    subType: inferredOverrides.subType
      ? normalizeChoiceTextField(sourceProfile?.subType)
      : (normalizeChoiceTextField(sourceProfile?.subType) || normalizeChoiceTextField(seedProfile?.subType)),
    description: inferredOverrides.description
      ? normalizeChoiceTextField(sourceProfile?.description)
      : (normalizeChoiceTextField(sourceProfile?.description) || normalizeChoiceTextField(seedProfile?.description)),
    services: inferredOverrides.services
      ? existingServices
      : (existingServices.length > 0 ? existingServices : normalizeChoiceServices(seedProfile?.services)),
    bundledServices: inferredOverrides.bundledServices
      ? existingBundledServices
      : (existingBundledServices.length > 0 ? existingBundledServices : normalizeChoiceServices(seedProfile?.bundledServices)),
    country: normalizeChoiceTextField(sourceProfile?.country),
    state: normalizeChoiceTextField(sourceProfile?.state),
    city: inferredOverrides.city
      ? normalizeChoiceTextField(sourceProfile?.city)
      : (normalizeChoiceTextField(sourceProfile?.city) || normalizeChoiceTextField(seedProfile?.city)),
    googleMapsLink: normalizeChoiceTextField(sourceProfile?.googleMapsLink),
    coverageAreas: inferredOverrides.coverageAreas
      ? existingCoverageAreas
      : (existingCoverageAreas.length > 0 ? existingCoverageAreas : normalizeChoiceCoverageAreas(seedProfile?.coverageAreas)),
    budgetRange: normalizeChoiceBudgetRange(sourceProfile?.budgetRange, seedProfile?.budgetRange),
    phone: normalizeChoiceTextField(sourceProfile?.phone),
    website: normalizeChoiceTextField(sourceProfile?.website),
    availabilitySettings: sourceProfile?.availabilitySettings || seedProfile.availabilitySettings,
    sourceVendorIds: Array.isArray(sourceProfile?.sourceVendorIds) ? sourceProfile.sourceVendorIds : seedProfile.sourceVendorIds,
    selectedVendorMedia: Array.isArray(sourceProfile?.selectedVendorMedia) ? sourceProfile.selectedVendorMedia : seedProfile.selectedVendorMedia,
    media: Array.isArray(sourceProfile?.media) ? sourceProfile.media : seedProfile.media,
    seedOverrides: inferredOverrides,
    isApproved: sourceProfile?.isApproved !== false,
    tier: 'Plus',
    isActive: sourceProfile?.isActive !== false,
    createdAt: sourceProfile?.createdAt || new Date(),
    updatedAt: new Date(),
  };
}

async function remapPlannerVendorIds(legacyIdMap) {
  const legacyIds = Object.keys(legacyIdMap);
  if (legacyIds.length === 0) {
    return 0;
  }

  const Planner = getPlannerModel();
  if (!Planner || typeof Planner.find !== 'function') {
    return 0;
  }

  const plannerDocs = await Planner.find({ 'vendors.id': { $in: legacyIds } })
    .select('_id vendors')
    .lean();

  let updatedCount = 0;
  for (const planner of plannerDocs) {
    let changed = false;
    const nextVendors = (Array.isArray(planner?.vendors) ? planner.vendors : []).map((vendor) => {
      const currentId = String(vendor?.id || '').trim();
      const nextId = legacyIdMap[currentId];
      if (!nextId) {
        return vendor;
      }

      changed = true;
      return {
        ...vendor,
        id: nextId,
      };
    });

    if (changed) {
      await Planner.updateOne({ _id: planner._id }, { $set: { vendors: nextVendors } });
      updatedCount += 1;
    }
  }

  return updatedCount;
}

async function migrateLegacyChoiceProfileId(ChoiceProfile, legacyProfile, canonicalProfile) {
  const tempType = `__legacy__${buildChoiceProfileId(legacyProfile?.type)}__${Date.now()}`;

  await ChoiceProfile.collection.updateOne(
    { _id: legacyProfile._id },
    { $set: { type: tempType } }
  );

  try {
    await ChoiceProfile.collection.insertOne(canonicalProfile);
  } catch (error) {
    await ChoiceProfile.collection.updateOne(
      { _id: legacyProfile._id },
      { $set: { type: legacyProfile.type } }
    );
    throw error;
  }

  await ChoiceProfile.deleteOne({ _id: legacyProfile._id });
}

async function main() {
  await connectDb();

  const ChoiceProfile = getChoiceProfileModel();
  if (!ChoiceProfile || typeof ChoiceProfile.find !== 'function') {
    throw new Error('ChoiceProfile model is unavailable.');
  }

  const existingProfiles = await ChoiceProfile.find({ type: { $in: DEFAULT_VCA_TYPES } })
    .select('-__v')
    .lean();
  const profilesByType = existingProfiles.reduce((map, profile) => {
    const type = String(profile?.type || '').trim();
    if (!type) {
      return map;
    }
    if (!map.has(type)) {
      map.set(type, []);
    }
    map.get(type).push(profile);
    return map;
  }, new Map());

  const legacyIdMap = {};
  let createdCount = 0;
  let updatedCount = 0;
  let migratedCount = 0;

  for (const type of DEFAULT_VCA_TYPES) {
    const seedProfile = buildDefaultChoiceProfileSeed(type);
    const profilesForType = profilesByType.get(type) || [];
    const canonicalExisting = profilesForType.find(profile => String(profile?._id || '') === seedProfile._id) || null;
    const legacyExisting = canonicalExisting ? null : (profilesForType[0] || null);
    const sourceProfile = canonicalExisting || legacyExisting;
    const nextDocument = buildMigratedChoiceProfileDocument(seedProfile, sourceProfile);

    if (canonicalExisting) {
      await ChoiceProfile.findOneAndUpdate(
        { _id: seedProfile._id },
        { $set: nextDocument },
        { new: true }
      );
      updatedCount += 1;
      continue;
    }

    if (legacyExisting) {
      await migrateLegacyChoiceProfileId(ChoiceProfile, legacyExisting, nextDocument);
      legacyIdMap[String(legacyExisting._id)] = seedProfile._id;
      migratedCount += 1;
      continue;
    }

    await ChoiceProfile.create(nextDocument);
    createdCount += 1;
  }

  const plannersUpdated = await remapPlannerVendorIds(legacyIdMap);

  console.info('Choice profile migration complete.', {
    createdCount,
    updatedCount,
    migratedCount,
    plannersUpdated,
    legacyIdMapSize: Object.keys(legacyIdMap).length,
  });
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error('Choice profile migration failed.', {
      message: error?.message || 'Unknown error',
      stack: error?.stack || '',
    });
    await mongoose.disconnect();
    process.exit(1);
  });
