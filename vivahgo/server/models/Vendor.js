import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
    sortOrder: { type: Number, default: 0 },
    filename: { type: String, default: '' },
    size: { type: Number, default: 0 },
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
  },
  { timestamps: true }
);

export default mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
