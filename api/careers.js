const careerCatalog = require('../config/careers.json');
const { connectDb, getCareerApplicationModel, handlePreflight, normalizeEmail, setCorsHeaders } = require('./_lib/core');
const { uploadPdfToDrive } = require('./_lib/googleDrive');

const MAX_RESUME_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_RESUME_SIZE_BYTES * 4 / 3) + 32;

function serializeCareer(job = {}) {
  return {
    id: job.id || '',
    title: job.title || '',
    team: job.team || '',
    location: job.location || '',
    type: job.type || '',
    summary: job.summary || '',
    highlights: Array.isArray(job.highlights) ? job.highlights : [],
  };
}

function serializeApplication(doc = {}) {
  const plain = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(plain._id || ''),
    fullName: plain.fullName || '',
    email: plain.email || '',
    phone: plain.phone || '',
    location: plain.location || '',
    linkedInUrl: plain.linkedInUrl || '',
    portfolioUrl: plain.portfolioUrl || '',
    coverLetter: plain.coverLetter || '',
    jobId: plain.jobId || '',
    jobTitle: plain.jobTitle || '',
    resumeDriveFileId: plain.resumeDriveFileId || '',
    resumeDriveFileName: plain.resumeDriveFileName || '',
    resumeDriveViewUrl: plain.resumeDriveViewUrl || '',
    resumeDriveDownloadUrl: plain.resumeDriveDownloadUrl || '',
    resumeOriginalFileName: plain.resumeOriginalFileName || '',
    resumeMimeType: plain.resumeMimeType || '',
    resumeSize: plain.resumeSize || 0,
    source: plain.source || '',
    status: plain.status || 'new',
    createdAt: plain.createdAt || null,
    updatedAt: plain.updatedAt || null,
  };
}

function sanitizeText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isLikelyHttpUrl(value) {
  if (!value) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeBase64Pdf(base64) {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Resume PDF is required.');
  }

  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;
  if (cleaned.length > MAX_BASE64_LENGTH) {
    throw new Error('Resume PDF exceeds the 2 MB size limit.');
  }

  const buffer = Buffer.from(cleaned, 'base64');
  if (!buffer.length) {
    throw new Error('Resume PDF is empty.');
  }
  if (buffer.length > MAX_RESUME_SIZE_BYTES) {
    throw new Error('Resume PDF exceeds the 2 MB size limit.');
  }
  if (buffer.slice(0, 4).toString() !== '%PDF') {
    throw new Error('Resume must be a valid PDF file.');
  }

  return buffer;
}

async function handler(req, res) {
  if (handlePreflight(req, res)) {
    return;
  }
  setCorsHeaders(req, res);

  if (req.method === 'GET') {
    return res.status(200).json({
      careers: careerCatalog.map(serializeCareer),
      limits: {
        resumeMimeType: 'application/pdf',
        resumeMaxSizeBytes: MAX_RESUME_SIZE_BYTES,
      },
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = req.body || {};
  const fullName = sanitizeText(body.fullName, 120);
  const email = normalizeEmail(body.email);
  const phone = sanitizeText(body.phone, 40);
  const location = sanitizeText(body.location, 120);
  const linkedInUrl = sanitizeText(body.linkedInUrl, 300);
  const portfolioUrl = sanitizeText(body.portfolioUrl, 300);
  const coverLetter = sanitizeText(body.coverLetter, 4000);
  const jobId = sanitizeText(body.jobId, 120);
  const resumeFilename = sanitizeText(body.resumeFilename, 255) || 'resume.pdf';
  const resumeMimeType = sanitizeText(body.resumeMimeType, 80) || 'application/pdf';

  if (!fullName) {
    return res.status(400).json({ error: 'fullName is required.' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required.' });
  }
  if (resumeMimeType !== 'application/pdf') {
    return res.status(400).json({ error: 'Resume must be uploaded as a PDF.' });
  }
  if (!isLikelyHttpUrl(linkedInUrl) || !isLikelyHttpUrl(portfolioUrl)) {
    return res.status(400).json({ error: 'Profile links must start with http:// or https://.' });
  }

  const job = careerCatalog.find(item => item.id === jobId);
  if (!job) {
    return res.status(400).json({ error: 'Selected role is not available.' });
  }

  let resumeBuffer;
  try {
    resumeBuffer = decodeBase64Pdf(body.resumeBase64);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const driveFile = await uploadPdfToDrive({
      buffer: resumeBuffer,
      filename: resumeFilename,
      fullName,
      jobId,
    });

    await connectDb();
    const CareerApplication = getCareerApplicationModel();
    const created = await CareerApplication.create({
      fullName,
      email,
      phone,
      location,
      linkedInUrl,
      portfolioUrl,
      coverLetter,
      jobId: job.id,
      jobTitle: job.title,
      resumeDriveFileId: driveFile.id,
      resumeDriveFileName: driveFile.name,
      resumeDriveViewUrl: driveFile.webViewLink,
      resumeDriveDownloadUrl: driveFile.webContentLink,
      resumeOriginalFileName: resumeFilename,
      resumeMimeType,
      resumeSize: resumeBuffer.length,
      source: 'careers-page',
    });

    return res.status(201).json({
      ok: true,
      application: serializeApplication(created),
    });
  } catch (error) {
    console.error('Career application submission failed:', error);
    return res.status(500).json({ error: error.message || 'Could not submit application.' });
  }
}

module.exports = handler;
module.exports.serializeApplication = serializeApplication;
