import { useRef, useState } from 'react';
import {
  fetchVerificationPresignedUrl,
  removeVendorVerificationDocument,
  saveVendorVerificationDocument,
} from '../api.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DOCUMENT_TYPE_OPTIONS = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'DRIVING_LICENSE', label: 'Driving License' },
  { value: 'OTHER', label: 'Other ID' },
];

function formatFileSize(size) {
  if (!size) {
    return '0 MB';
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusCopy(status) {
  if (status === 'approved') return { label: 'Verified', className: 'bg-emerald-100 text-emerald-700' };
  if (status === 'rejected') return { label: 'Needs attention', className: 'bg-red-100 text-red-700' };
  if (status === 'submitted') return { label: 'Under review', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Not submitted', className: 'bg-stone-100 text-stone-700' };
}

export default function VendorVerificationManager({ token, vendor, onVendorUpdated }) {
  const [documentType, setDocumentType] = useState('AADHAAR');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const inputRef = useRef(null);

  const status = getStatusCopy(vendor?.verificationStatus);
  const documents = Array.isArray(vendor?.verificationDocuments) ? vendor.verificationDocuments : [];

  async function handleFilesSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setError('');

    if (file.size > MAX_FILE_SIZE) {
      setError('Verification files must be 10 MB or smaller.');
      return;
    }

    setIsUploading(true);
    try {
      const presigned = await fetchVerificationPresignedUrl(token, {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presigned.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }
          reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(file);
      });

      const data = await saveVendorVerificationDocument(token, {
        key: presigned.key,
        filename: file.name,
        size: file.size,
        contentType: file.type,
        documentType,
      });
      onVendorUpdated?.(data.vendor);
    } catch (nextError) {
      setError(nextError.message || 'Could not upload verification document.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemove(documentId) {
    setError('');
    setRemovingId(documentId);
    try {
      const data = await removeVendorVerificationDocument(token, documentId);
      onVendorUpdated?.(data.vendor);
    } catch (nextError) {
      setError(nextError.message || 'Could not remove verification document.');
    } finally {
      setRemovingId('');
    }
  }

  return (
    <section className="rounded-[28px] border border-stone-200 bg-gradient-to-br from-stone-50 via-white to-amber-50 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Identity Verification</p>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <h3 className="mt-2 text-xl font-semibold text-stone-900">Keep approvals moving without leaving the portfolio flow</h3>
          <p className="mt-2 text-sm text-stone-600">
            Upload one government-issued identity document for review. It stays private and is only visible to VivahGo admins.
          </p>
          {vendor?.verificationNotes && (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {vendor.verificationNotes}
            </div>
          )}
        </div>

        <div className="grid w-full gap-3 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm lg:max-w-sm">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.18em] text-stone-400">Document type</span>
            <select
              value={documentType}
              onChange={event => setDocumentType(event.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              {DOCUMENT_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFilesSelected}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {isUploading ? 'Uploading document...' : 'Upload Verification Document'}
          </button>
          <p className="text-xs text-stone-500">Accepted: PDF, JPG, PNG, WebP. Max 10 MB.</p>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>
      )}

      <div className="mt-5 grid gap-3">
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 px-4 py-6 text-sm text-stone-500">
            No verification document uploaded yet.
          </div>
        ) : (
          documents.map(document => (
            <div key={document._id} className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">{document.documentType.replaceAll('_', ' ')}</span>
                  <span className="text-sm font-medium text-stone-900">{document.filename || 'Verification document'}</span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {formatFileSize(document.size)}{document.uploadedAt ? ` · Uploaded ${new Date(document.uploadedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {document.accessUrl && (
                  <a
                    href={document.accessUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Preview
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(document._id)}
                  disabled={removingId === document._id}
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  {removingId === document._id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
