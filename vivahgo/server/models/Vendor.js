import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    key: { type: String, default: '', trim: true },
    url: { type: String, required: true },
    type: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
    sortOrder: { type: Number, default: 0 },
    filename: { type: String, default: '', trim: true, maxlength: 255 },
    size: { type: Number, default: 0 },
    caption: { type: String, default: '', trim: true, maxlength: 280 },
    altText: { type: String, default: '', trim: true, maxlength: 180 },
    isCover: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
  },
  { _id: true }
);

const coverageAreaSchema = new mongoose.Schema(
  {
    country: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    filename: { type: String, default: '', trim: true, maxlength: 255 },
    size: { type: Number, default: 0 },
    contentType: { type: String, default: '', trim: true, maxlength: 120 },
    documentType: {
      type: String,
      enum: ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'OTHER'],
      default: 'OTHER',
    },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const availabilityOverrideSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, trim: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    maxCapacity: { type: Number, required: true, min: 0, max: 99 },
    bookingsCount: { type: Number, default: 0, min: 0, max: 99 },
  },
  { _id: true }
);

const availabilitySettingsSchema = new mongoose.Schema(
  {
    hasDefaultCapacity: { type: Boolean, default: true },
    defaultMaxCapacity: { type: Number, default: 1, min: 0, max: 99 },
    dateOverrides: { type: [availabilityOverrideSchema], default: [] },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services', 'Bride', 'Groom'],
      required: true,
    },
    subType: { type: String, default: '', trim: true },
    bundledServices: { type: [String], default: [] },
    country: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    googleMapsLink: { type: String, default: '', trim: true },
    coverageAreas: { type: [coverageAreaSchema], default: [] },
    budgetRange: {
      min: { type: Number },
      max: { type: Number },
    },
    phone: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    isApproved: { type: Boolean, default: false },
    tier: {
      type: String,
      enum: ['Free', 'Plus'],
      default: 'Free',
    },
    media: { type: [mediaSchema], default: [] },
    verificationStatus: {
      type: String,
      enum: ['not_submitted', 'submitted', 'approved', 'rejected'],
      default: 'not_submitted',
    },
    verificationNotes: { type: String, default: '', trim: true, maxlength: 1000 },
    verificationReviewedAt: { type: Date, default: null },
    verificationReviewedBy: { type: String, default: '', trim: true },
    verificationDocuments: { type: [verificationDocumentSchema], default: [] },
    availabilitySettings: { type: availabilitySettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export default mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
