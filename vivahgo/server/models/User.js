import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    picture: {
      type: String,
      default: '',
    },
    stripeCustomerId: {
      type: String,
      default: '',
    },
    subscriptionId: {
      type: String,
      default: '',
    },
    subscriptionTier: {
      type: String,
      enum: ['starter', 'premium', 'studio'],
      default: 'starter',
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'inactive', 'canceled', 'past_due'],
      default: 'active',
    },
    subscriptionCurrentPeriodEnd: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.User || mongoose.model('User', userSchema);