import mongoose from 'mongoose';

const collaboratorSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer',
    },
    addedBy: {
      type: String,
      default: '',
    },
    addedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { _id: false }
);

const plannerSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Array of marriage plans with metadata
    marriages: {
      type: [
        {
          id: String, // UUID or timestamp
          bride: String,
          groom: String,
          date: String,
          venue: String,
          budget: String,
          guests: String,
          websiteSlug: String,
          websiteSettings: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
          },
          reminderSettings: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
          },
          template: String, // 'blank', 'traditional', 'modern', 'minimalist', 'adventure'
          collaborators: {
            type: [collaboratorSchema],
            default: [],
          },
          createdAt: {
            type: Date,
            default: () => new Date(),
          },
        },
      ],
      default: [],
    },
    // ID of the currently active marriage plan
    activePlanId: {
      type: String,
      default: null,
    },
    customTemplates: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // Legacy wedding field for backward compatibility
    wedding: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    // All data items now include planId field for filtering
    events: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    expenses: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    guests: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    vendors: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    tasks: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

export default mongoose.models.Planner || mongoose.model('Planner', plannerSchema);
