import mongoose from 'mongoose';

const selectedMediaSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ['vendor', 'admin'],
      default: 'vendor',
    },
    vendorId: { type: String, default: '', trim: true },
    vendorName: { type: String, default: '', trim: true },
    sourceMediaId: { type: String, default: '', trim: true },
    key: { type: String, default: '', trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
    sortOrder: { type: Number, default: 0 },
    filename: { type: String, default: '', trim: true, maxlength: 255 },
    size: { type: Number, default: 0, min: 0 },
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

const choiceProfileSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Venue', 'Photography', 'Catering', 'Wedding Invitations', 'Wedding Gifts', 'Music', 'Wedding Transportation', 'Tent House', 'Wedding Entertainment', 'Florists', 'Wedding Planners', 'Wedding Videography', 'Honeymoon', 'Wedding Decorators', 'Wedding Cakes', 'Wedding DJ', 'Pandit', 'Photobooth', 'Astrologers', 'Party Places', 'Choreographer', 'Bridal & Pre-Bridal', 'Groom Services', 'Bride', 'Groom'],
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    subType: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    services: { type: [String], default: [] },
    bundledServices: { type: [String], default: [] },
    country: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    googleMapsLink: { type: String, default: '', trim: true },
    coverageAreas: { type: [coverageAreaSchema], default: [] },
    budgetRange: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
    },
    phone: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
    sourceVendorIds: { type: [String], default: [] },
    selectedMedia: { type: [selectedMediaSchema], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.ChoiceProfile || mongoose.model('ChoiceProfile', choiceProfileSchema);
