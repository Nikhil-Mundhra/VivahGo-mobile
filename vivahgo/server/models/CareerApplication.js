import mongoose from 'mongoose';

const careerApplicationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160, index: true },
    phone: { type: String, default: '', trim: true, maxlength: 40 },
    location: { type: String, default: '', trim: true, maxlength: 120 },
    linkedInUrl: { type: String, default: '', trim: true, maxlength: 300 },
    portfolioUrl: { type: String, default: '', trim: true, maxlength: 300 },
    coverLetter: { type: String, default: '', trim: true, maxlength: 4000 },
    jobId: { type: String, required: true, trim: true, maxlength: 120, index: true },
    jobTitle: { type: String, required: true, trim: true, maxlength: 160 },
    resumeDriveFileId: { type: String, required: true, trim: true },
    resumeDriveFileName: { type: String, required: true, trim: true },
    resumeDriveViewUrl: { type: String, default: '', trim: true },
    resumeDriveDownloadUrl: { type: String, default: '', trim: true },
    resumeOriginalFileName: { type: String, default: '', trim: true, maxlength: 255 },
    resumeMimeType: { type: String, default: 'application/pdf', trim: true },
    resumeSize: { type: Number, default: 0 },
    source: { type: String, default: 'careers-page', trim: true },
    status: { type: String, enum: ['new', 'reviewing', 'shortlisted', 'rejected'], default: 'new' },
  },
  { timestamps: true }
);

export default mongoose.models.CareerApplication || mongoose.model('CareerApplication', careerApplicationSchema);
